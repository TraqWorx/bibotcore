import { createAdminClient } from '@/lib/supabase-server'
import { ghlFetch, GhlRateLimitError, pmap } from './ghl'
import { APULIA_LOCATION_ID } from './fields'

interface QueueRow {
  id: string
  contact_id: string | null
  ghl_id: string | null
  action: 'create' | 'update' | 'delete' | 'add_tag' | 'remove_tag' | 'set_field'
  payload: Record<string, unknown> | null
  attempts: number
}

interface ContactRow {
  id: string
  ghl_id: string | null
  email: string | null
  phone: string | null
  first_name: string | null
  last_name: string | null
  tags: string[] | null
  custom_fields: Record<string, string> | null
  codice_amministratore: string | null
  pod_pdr: string | null
  is_amministratore: boolean
}

const BATCH_LIMIT = 40
const CONCURRENCY = 2
const RATE_LIMIT_PAUSE_MS = 90_000
const MAX_ATTEMPTS = 10
const MAX_BACKOFF_MS = 5 * 60_000

/**
 * Throw this for failures that won't resolve on retry — typically
 * data-integrity conflicts (email/phone collision between distinct
 * Bibot rows). The worker marks the op + contact as failed immediately
 * without burning retry attempts.
 */
export class PermanentSyncError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermanentSyncError'
  }
}

export interface DrainResult {
  claimed: number
  completed: number
  failed: number
  rateLimited: boolean
}

/**
 * Drain a batch of pending sync ops to GHL. Per-contact ops are processed
 * sequentially; up to CONCURRENCY contacts run in parallel.
 *
 * On a 429 storm: every op claimed in this batch is reverted to pending
 * and pushed forward 90s, the worker exits early. This mirrors the
 * pause-on-rate-limit pattern the importers used to use, but for an
 * always-on background drainer.
 */
export async function drainQueue(): Promise<DrainResult> {
  const sb = createAdminClient()
  const now = new Date().toISOString()

  // 1. Find candidates.
  const { data: candidates } = await sb
    .from('apulia_sync_queue')
    .select('id')
    .eq('status', 'pending')
    .lte('next_attempt_at', now)
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT)

  if (!candidates?.length) return { claimed: 0, completed: 0, failed: 0, rateLimited: false }

  // 2. Atomically claim by transitioning status (CAS-style — only those
  // still pending get picked up; concurrent workers split the batch).
  const { data: claimed } = await sb
    .from('apulia_sync_queue')
    .update({ status: 'in_progress', last_attempt_at: now })
    .in('id', candidates.map((c) => c.id))
    .eq('status', 'pending')
    .select('id, contact_id, ghl_id, action, payload, attempts')

  const ops = (claimed ?? []) as QueueRow[]
  if (!ops.length) return { claimed: 0, completed: 0, failed: 0, rateLimited: false }

  // 3. Group by contact_id; preserve queue order within group.
  const groups = new Map<string, QueueRow[]>()
  for (const op of ops) {
    const key = op.contact_id ?? op.id
    let arr = groups.get(key)
    if (!arr) { arr = []; groups.set(key, arr) }
    arr.push(op)
  }

  let rateLimited = false
  let completed = 0
  let failed = 0

  await pmap([...groups.values()], async (groupOps) => {
    for (const op of groupOps) {
      if (rateLimited) return
      try {
        const outcome = await processOp(op)
        if (outcome === 'completed') completed++
        else if (outcome === 'requeued') { /* deferred for later */ }
      } catch (err) {
        if (err instanceof GhlRateLimitError) {
          rateLimited = true
          return
        }
        if (err instanceof PermanentSyncError) {
          await markFailedNow(op, err.message)
        } else {
          await handleError(op, err instanceof Error ? err.message : String(err))
        }
        failed++
      }
    }
  }, CONCURRENCY)

  // 4. If we hit a rate limit, revert all still-in-progress claimed ops.
  if (rateLimited) {
    const next = new Date(Date.now() + RATE_LIMIT_PAUSE_MS).toISOString()
    await sb
      .from('apulia_sync_queue')
      .update({ status: 'pending', next_attempt_at: next, last_error: 'Rate limit GHL: pausa di 90 secondi prima di riprovare' })
      .in('id', ops.map((o) => o.id))
      .eq('status', 'in_progress')
  }

  return { claimed: ops.length, completed, failed, rateLimited }
}

async function processOp(op: QueueRow): Promise<'completed' | 'requeued'> {
  const sb = createAdminClient()
  const contactId = op.contact_id
  const row = contactId
    ? ((await sb.from('apulia_contacts').select('id, ghl_id, email, phone, first_name, last_name, tags, custom_fields, codice_amministratore, pod_pdr, is_amministratore').eq('id', contactId).maybeSingle()).data as ContactRow | null)
    : null

  switch (op.action) {
    case 'create': {
      if (!row) {
        // Contact was deleted before we could create — nothing to do.
        await markCompleted(op.id)
        return 'completed'
      }
      const body = buildContactBody(row, { create: true })
      const r = await ghlFetch('/contacts/', { method: 'POST', body: JSON.stringify(body) })
      let newGhlId: string | undefined
      let viaUpsert = false
      if (!r.ok) {
        const text = await r.text()
        if (r.status === 400 && /duplicat/i.test(text)) {
          const ur = await ghlFetch('/contacts/upsert', { method: 'POST', body: JSON.stringify(body) })
          if (!ur.ok) throw new Error(`Upsert contatto GHL fallito (${ur.status}): ${(await ur.text()).slice(0, 200)}`)
          const uj = (await ur.json()) as { contact?: { id: string }; id?: string }
          newGhlId = uj.contact?.id ?? uj.id
          viaUpsert = true
        } else {
          throw new Error(`Creazione contatto GHL fallita (${r.status}): ${text.slice(0, 200)}`)
        }
      } else {
        const j = (await r.json()) as { contact?: { id: string }; id?: string }
        newGhlId = j.contact?.id ?? j.id
      }
      if (!newGhlId) throw new Error('GHL non ha restituito un id contatto')

      // Stamp ghl_id back. The unique index on apulia_contacts.ghl_id can
      // refuse this if a sibling Bibot row already claimed the same GHL
      // contact (input data had two rows that GHL collapsed by email or
      // phone). When that happens, decide between two outcomes:
      //
      //   A. Sibling has the SAME identifier (codice_amministratore for
      //      admins, pod_pdr for condomini) — it's a true duplicate of
      //      this row. Delete this Bibot row and mark op completed.
      //
      //   B. Sibling has a DIFFERENT identifier but GHL collapsed both
      //      to one contact (typically same email). Leave this row in
      //      place and mark op failed so the user can fix the data.
      const stamp = await sb
        .from('apulia_contacts')
        .update({ ghl_id: newGhlId, sync_status: 'synced' })
        .eq('id', row.id)
      if (stamp.error) {
        if (/duplicate key|unique constraint/i.test(stamp.error.message)) {
          const { data: sibling } = await sb
            .from('apulia_contacts')
            .select('id, codice_amministratore, pod_pdr, first_name, is_amministratore')
            .eq('ghl_id', newGhlId)
            .maybeSingle()
          // Same entity = same kind (admin/condomino) AND same identity
          // (codice for admins, pod_pdr for condomini). codice on a
          // condomino is its admin's code, not its own — so we must NOT
          // match an admin against a condomino just because they share
          // an admin code.
          const sameKind = sibling != null && row.is_amministratore === sibling.is_amministratore
          const sameId = sameKind && (
            (row.is_amministratore && row.codice_amministratore && sibling.codice_amministratore && row.codice_amministratore === sibling.codice_amministratore) ||
            (!row.is_amministratore && row.pod_pdr && sibling.pod_pdr && row.pod_pdr === sibling.pod_pdr)
          )
          if (sibling && sameId) {
            // Case A: true duplicate. Hard-delete this row + cancel any
            // sibling pending ops. The canonical row (sibling) carries
            // the data forward.
            await sb.from('apulia_sync_queue').delete().eq('contact_id', row.id).neq('id', op.id).in('status', ['pending', 'in_progress'])
            await sb.from('apulia_contacts').delete().eq('id', row.id)
            await markCompleted(op.id)
            return 'completed'
          }
          // Case B: email/phone collision between distinct entities. This
          // is a permanent data conflict — retrying won't help, so we
          // throw a PermanentSyncError to skip retries and mark failed
          // immediately.
          throw new PermanentSyncError(
            `Il contatto GHL ${newGhlId} è già collegato a un'altra riga Bibot ` +
            `(${sibling?.first_name ?? 'sconosciuta'}, codice ${sibling?.codice_amministratore ?? '—'}). ` +
            `Collisione email/telefono${viaUpsert ? ' tramite upsert' : ''}. ` +
            `Modifica i dati in conflitto per riprovare automaticamente.`,
          )
        }
        throw new Error(`Errore salvataggio ghl_id: ${stamp.error.message}`)
      }
      await markCompleted(op.id)
      // Stamp ghl_id onto sibling pending ops for this contact so they
      // don't have to wait a cycle of "ghl_id null → requeue".
      await sb.from('apulia_sync_queue').update({ ghl_id: newGhlId }).eq('contact_id', row.id).is('ghl_id', null).neq('id', op.id)
      return 'completed'
    }
    case 'update': {
      if (!row) { await markCompleted(op.id); return 'completed' }
      const ghlId = row.ghl_id ?? op.ghl_id
      if (!ghlId) { await markPending(op.id, 30_000, 'In attesa della creazione su GHL'); return 'requeued' }
      const body = buildContactBody(row, { create: false })
      const r = await ghlFetch(`/contacts/${ghlId}`, { method: 'PUT', body: JSON.stringify(body) })
      if (!r.ok) throw new Error(`Aggiornamento contatto GHL fallito (${r.status}): ${(await r.text()).slice(0, 200)}`)
      await markCompleted(op.id)
      await maybeFlipToSynced(row.id)
      return 'completed'
    }
    case 'delete': {
      const ghlId = op.ghl_id ?? row?.ghl_id
      if (ghlId) {
        const r = await ghlFetch(`/contacts/${ghlId}`, { method: 'DELETE' })
        if (!r.ok && r.status !== 404) {
          throw new Error(`Eliminazione contatto GHL fallita (${r.status}): ${(await r.text()).slice(0, 200)}`)
        }
      }
      // Hard-delete the row + cancel any sibling pending ops.
      if (op.contact_id) {
        await sb.from('apulia_sync_queue').delete().eq('contact_id', op.contact_id).neq('id', op.id).in('status', ['pending', 'in_progress'])
        await sb.from('apulia_contacts').delete().eq('id', op.contact_id)
      }
      await markCompleted(op.id)
      return 'completed'
    }
    case 'add_tag': {
      const tag = (op.payload as { tag?: string } | null)?.tag
      if (!tag) { await markCompleted(op.id); return 'completed' }
      const ghlId = row?.ghl_id ?? op.ghl_id
      if (!ghlId) { await markPending(op.id, 30_000, 'In attesa della creazione su GHL'); return 'requeued' }
      const r = await ghlFetch(`/contacts/${ghlId}/tags`, { method: 'POST', body: JSON.stringify({ tags: [tag] }) })
      if (!r.ok && r.status !== 404) throw new Error(`Aggiunta tag "${tag}" fallita (${r.status}): ${(await r.text()).slice(0, 200)}`)
      await markCompleted(op.id)
      if (op.contact_id) await maybeFlipToSynced(op.contact_id)
      return 'completed'
    }
    case 'remove_tag': {
      const tag = (op.payload as { tag?: string } | null)?.tag
      if (!tag) { await markCompleted(op.id); return 'completed' }
      const ghlId = row?.ghl_id ?? op.ghl_id
      if (!ghlId) { await markPending(op.id, 30_000, 'In attesa della creazione su GHL'); return 'requeued' }
      const r = await ghlFetch(`/contacts/${ghlId}/tags`, { method: 'DELETE', body: JSON.stringify({ tags: [tag] }) })
      // 404 / "tag not on contact" is fine — idempotent semantics.
      if (!r.ok && r.status !== 404) throw new Error(`Rimozione tag "${tag}" fallita (${r.status}): ${(await r.text()).slice(0, 200)}`)
      await markCompleted(op.id)
      if (op.contact_id) await maybeFlipToSynced(op.contact_id)
      return 'completed'
    }
    case 'set_field': {
      const p = (op.payload as { fieldId?: string; value?: unknown } | null) ?? {}
      const fieldId = p.fieldId
      const value = p.value
      if (!fieldId) { await markCompleted(op.id); return 'completed' }
      const ghlId = row?.ghl_id ?? op.ghl_id
      if (!ghlId) { await markPending(op.id, 30_000, 'In attesa della creazione su GHL'); return 'requeued' }
      const r = await ghlFetch(`/contacts/${ghlId}`, {
        method: 'PUT',
        body: JSON.stringify({ customFields: [{ id: fieldId, value: normalizeFieldValue(value ?? '') }] }),
      })
      if (!r.ok) throw new Error(`Aggiornamento campo "${fieldId}" su GHL fallito (${r.status}): ${(await r.text()).slice(0, 200)}`)
      await markCompleted(op.id)
      if (op.contact_id) await maybeFlipToSynced(op.contact_id)
      return 'completed'
    }
  }
}

function buildContactBody(row: ContactRow, opts: { create: boolean }): Record<string, unknown> {
  const cf = (row.custom_fields ?? {}) as Record<string, string>
  const customFields = Object.entries(cf).map(([id, value]) => ({ id, value: normalizeFieldValue(value) }))
  const body: Record<string, unknown> = { customFields }
  if (row.first_name != null) body.firstName = row.first_name
  if (row.last_name != null) body.lastName = row.last_name
  if (row.email != null) body.email = row.email
  if (row.phone != null) body.phone = row.phone
  if (row.tags != null) body.tags = row.tags
  if (opts.create) body.locationId = APULIA_LOCATION_ID
  return body
}

/**
 * Normalize values before pushing to GHL.
 *
 * Italian-formatted dates (DD/MM/YYYY) are converted to ISO YYYY-MM-DD
 * because GHL date custom fields reject the slash form ("Invalid Custom
 * Field Value"). Excel cell display strings often look like "22/12/2023"
 * or "31/12/3999" (sentinel "no end date" value) — we convert both.
 *
 * Anything that isn't a recognizable DD/MM/YYYY string is passed through.
 */
function normalizeFieldValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return value
  const dd = m[1].padStart(2, '0')
  const mm = m[2].padStart(2, '0')
  const yyyy = m[3]
  return `${yyyy}-${mm}-${dd}`
}

async function markCompleted(opId: string): Promise<void> {
  const sb = createAdminClient()
  await sb.from('apulia_sync_queue').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', opId)
}

async function markPending(opId: string, delayMs: number, reason: string): Promise<void> {
  const sb = createAdminClient()
  await sb.from('apulia_sync_queue').update({
    status: 'pending',
    next_attempt_at: new Date(Date.now() + delayMs).toISOString(),
    last_error: reason,
  }).eq('id', opId)
}

/** Mark an op + contact as failed immediately, no retries. */
async function markFailedNow(op: QueueRow, message: string): Promise<void> {
  const sb = createAdminClient()
  await sb.from('apulia_sync_queue').update({
    status: 'failed',
    attempts: (op.attempts ?? 0) + 1,
    last_error: message.slice(0, 1000),
    last_attempt_at: new Date().toISOString(),
  }).eq('id', op.id)
  if (op.contact_id) {
    await sb.from('apulia_contacts').update({
      sync_status: 'failed',
      sync_error: message.slice(0, 1000),
    }).eq('id', op.contact_id)
  }
}

async function handleError(op: QueueRow, message: string): Promise<void> {
  const sb = createAdminClient()
  const attempts = (op.attempts ?? 0) + 1
  if (attempts >= MAX_ATTEMPTS) {
    await sb.from('apulia_sync_queue').update({
      status: 'failed',
      attempts,
      last_error: message.slice(0, 1000),
    }).eq('id', op.id)
    // Also mark the contact's sync_status='failed' + copy the error so it
    // surfaces in dashboards / list pages, not just the queue panel.
    if (op.contact_id) {
      await sb.from('apulia_contacts').update({
        sync_status: 'failed',
        sync_error: message.slice(0, 1000),
      }).eq('id', op.contact_id)
    }
    return
  }
  const backoffMs = Math.min(MAX_BACKOFF_MS, Math.pow(2, attempts) * 1000)
  await sb.from('apulia_sync_queue').update({
    status: 'pending',
    attempts,
    last_error: message.slice(0, 1000),
    next_attempt_at: new Date(Date.now() + backoffMs).toISOString(),
  }).eq('id', op.id)
}

/**
 * Flip a contact's sync_status to 'synced' if no more pending or
 * in-progress ops remain on its queue. Skips rows already in
 * sync_status='pending_delete' since those are awaiting hard-delete.
 */
async function maybeFlipToSynced(contactId: string): Promise<void> {
  const sb = createAdminClient()
  const { count } = await sb
    .from('apulia_sync_queue')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', contactId)
    .in('status', ['pending', 'in_progress'])
  if ((count ?? 0) > 0) return
  await sb
    .from('apulia_contacts')
    .update({ sync_status: 'synced' })
    .eq('id', contactId)
    .neq('sync_status', 'pending_delete')
}

/**
 * Recovery: any op stuck in 'in_progress' for more than `staleMs` is
 * presumed dead (worker crashed mid-batch). Reverts to pending so the
 * next drain picks it up.
 */
export async function recoverStaleInProgress(staleMs: number = 5 * 60_000): Promise<number> {
  const sb = createAdminClient()
  const cutoff = new Date(Date.now() - staleMs).toISOString()
  const { data } = await sb
    .from('apulia_sync_queue')
    .update({ status: 'pending', next_attempt_at: new Date().toISOString() })
    .eq('status', 'in_progress')
    .lt('last_attempt_at', cutoff)
    .select('id')
  return data?.length ?? 0
}

/** How many pending ops are eligible for the next run? */
export async function countDuePending(): Promise<number> {
  const sb = createAdminClient()
  const { count } = await sb
    .from('apulia_sync_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
  return count ?? 0
}
