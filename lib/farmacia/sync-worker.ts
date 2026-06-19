import { createAdminClient } from '@/lib/supabase-server'
import { ghlFetch, GhlRateLimitError, pmap } from './ghl'
import { FARMACIA_LOCATION_ID } from './fields'

interface QueueRow {
  id: string
  contact_id: string | null
  ghl_id: string | null
  action: 'create' | 'update' | 'delete' | 'add_tag' | 'remove_tag' | 'set_field'
  payload: Record<string, unknown> | null
  attempts: number
}

export interface ContactRow {
  id: string
  ghl_id: string | null
  email: string | null
  phone: string | null
  first_name: string | null
  last_name: string | null
  tags: string[] | null
  custom_fields: Record<string, string> | null
}

const BATCH_LIMIT = 40
const CONCURRENCY = 2
const RATE_LIMIT_PAUSE_MS = 90_000
const MAX_ATTEMPTS = 10
const MAX_BACKOFF_MS = 5 * 60_000

export interface DrainResult {
  claimed: number
  completed: number
  failed: number
  rateLimited: boolean
}

/** Build the GHL contact payload from a farmacia_contacts row. Pure — exported for tests. */
export function buildContactBody(row: ContactRow, opts: { create: boolean }): Record<string, unknown> {
  const cf = (row.custom_fields ?? {}) as Record<string, string>
  const customFields = Object.entries(cf).map(([id, value]) => ({ id, value }))
  const body: Record<string, unknown> = { customFields }
  if (row.first_name != null) body.firstName = row.first_name
  if (row.last_name != null) body.lastName = row.last_name
  if (row.email != null) body.email = row.email
  if (row.phone != null) body.phone = row.phone
  if (row.tags != null) body.tags = row.tags
  if (opts.create) body.locationId = FARMACIA_LOCATION_ID
  return body
}

/** Drain a batch of pending sync ops to GHL. Mirrors lib/apulia/sync-worker.ts. */
export async function drainQueue(): Promise<DrainResult> {
  const sb = createAdminClient()
  const now = new Date().toISOString()

  const { data: candidates } = await sb
    .from('farmacia_sync_queue')
    .select('id')
    .eq('status', 'pending')
    .lte('next_attempt_at', now)
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT)
  if (!candidates?.length) return { claimed: 0, completed: 0, failed: 0, rateLimited: false }

  const { data: claimed } = await sb
    .from('farmacia_sync_queue')
    .update({ status: 'in_progress', last_attempt_at: now })
    .in('id', candidates.map((c) => c.id))
    .eq('status', 'pending')
    .select('id, contact_id, ghl_id, action, payload, attempts')
  const ops = (claimed ?? []) as QueueRow[]
  if (!ops.length) return { claimed: 0, completed: 0, failed: 0, rateLimited: false }

  const groups = new Map<string, QueueRow[]>()
  for (const op of ops) {
    const key = op.contact_id ?? op.id
    const arr = groups.get(key) ?? []
    arr.push(op)
    groups.set(key, arr)
  }

  let rateLimited = false
  let completed = 0
  let failed = 0

  await pmap([...groups.values()], async (groupOps) => {
    for (const op of groupOps) {
      if (rateLimited) return
      try {
        await processOp(op)
        completed++
      } catch (err) {
        if (err instanceof GhlRateLimitError) { rateLimited = true; return }
        await handleError(op, err instanceof Error ? err.message : String(err))
        failed++
      }
    }
  }, CONCURRENCY)

  if (rateLimited) {
    const next = new Date(Date.now() + RATE_LIMIT_PAUSE_MS).toISOString()
    await sb
      .from('farmacia_sync_queue')
      .update({ status: 'pending', next_attempt_at: next, last_error: 'Rate limit GHL: pausa 90s' })
      .in('id', ops.map((o) => o.id))
      .eq('status', 'in_progress')
  }

  return { claimed: ops.length, completed: completed - (rateLimited ? 0 : 0), failed, rateLimited }
}

async function loadContact(sb: ReturnType<typeof createAdminClient>, id: string | null): Promise<ContactRow | null> {
  if (!id) return null
  const { data } = await sb
    .from('farmacia_contacts')
    .select('id, ghl_id, email, phone, first_name, last_name, tags, custom_fields')
    .eq('id', id)
    .maybeSingle()
  return (data as ContactRow | null) ?? null
}

async function processOp(op: QueueRow): Promise<void> {
  const sb = createAdminClient()
  const row = await loadContact(sb, op.contact_id)

  switch (op.action) {
    case 'create': {
      if (!row) return markCompleted(op.id)
      const r = await ghlFetch('/contacts/', { method: 'POST', body: JSON.stringify(buildContactBody(row, { create: true })) })
      let ghlId: string | undefined
      if (!r.ok) {
        const text = await r.text()
        if (r.status === 400 && /duplicat/i.test(text)) {
          // Same person already in GHL — link to the existing contact (a
          // pharmacy customer is one person across channels, so linking,
          // not failing, is correct).
          ghlId = (await findGhlContact(row.email, row.phone)) ?? undefined
          if (!ghlId) throw new Error(`Creazione contatto fallita (${r.status}): ${text.slice(0, 200)}`)
        } else {
          throw new Error(`Creazione contatto fallita (${r.status}): ${text.slice(0, 200)}`)
        }
      } else {
        const j = (await r.json()) as { contact?: { id: string }; id?: string }
        ghlId = j.contact?.id ?? j.id
      }
      if (!ghlId) throw new Error('GHL non ha restituito un id contatto')
      await sb.from('farmacia_contacts').update({ ghl_id: ghlId, sync_status: 'synced' }).eq('id', row.id)
      await sb.from('farmacia_sync_queue').update({ ghl_id: ghlId }).eq('contact_id', row.id).is('ghl_id', null).neq('id', op.id)
      return markCompleted(op.id)
    }
    case 'update': {
      if (!row) return markCompleted(op.id)
      const ghlId = row.ghl_id ?? op.ghl_id
      if (!ghlId) return markPending(op.id, 30_000, 'In attesa della creazione su GHL')
      const r = await ghlFetch(`/contacts/${ghlId}`, { method: 'PUT', body: JSON.stringify(buildContactBody(row, { create: false })) })
      if (!r.ok) throw new Error(`Aggiornamento fallito (${r.status}): ${(await r.text()).slice(0, 200)}`)
      await markCompleted(op.id)
      return maybeFlipToSynced(row.id)
    }
    case 'delete': {
      const ghlId = op.ghl_id ?? row?.ghl_id
      if (ghlId) {
        const r = await ghlFetch(`/contacts/${ghlId}`, { method: 'DELETE' })
        if (!r.ok && r.status !== 404) throw new Error(`Eliminazione fallita (${r.status}): ${(await r.text()).slice(0, 200)}`)
      }
      if (op.contact_id) {
        await sb.from('farmacia_sync_queue').delete().eq('contact_id', op.contact_id).neq('id', op.id).in('status', ['pending', 'in_progress'])
        await sb.from('farmacia_contacts').delete().eq('id', op.contact_id)
      }
      return markCompleted(op.id)
    }
    case 'add_tag':
    case 'remove_tag': {
      const tag = (op.payload as { tag?: string } | null)?.tag
      if (!tag) return markCompleted(op.id)
      const ghlId = row?.ghl_id ?? op.ghl_id
      if (!ghlId) return markPending(op.id, 30_000, 'In attesa della creazione su GHL')
      const method = op.action === 'add_tag' ? 'POST' : 'DELETE'
      const r = await ghlFetch(`/contacts/${ghlId}/tags`, { method, body: JSON.stringify({ tags: [tag] }) })
      if (!r.ok && r.status !== 404) throw new Error(`Tag "${tag}" fallito (${r.status}): ${(await r.text()).slice(0, 200)}`)
      await markCompleted(op.id)
      if (op.contact_id) return maybeFlipToSynced(op.contact_id)
      return
    }
    case 'set_field': {
      const p = (op.payload as { fieldId?: string; value?: unknown } | null) ?? {}
      if (!p.fieldId) return markCompleted(op.id)
      const ghlId = row?.ghl_id ?? op.ghl_id
      if (!ghlId) return markPending(op.id, 30_000, 'In attesa della creazione su GHL')
      const r = await ghlFetch(`/contacts/${ghlId}`, {
        method: 'PUT',
        body: JSON.stringify({ customFields: [{ id: p.fieldId, value: p.value ?? '' }] }),
      })
      if (!r.ok) throw new Error(`Campo "${p.fieldId}" fallito (${r.status}): ${(await r.text()).slice(0, 200)}`)
      await markCompleted(op.id)
      if (op.contact_id) return maybeFlipToSynced(op.contact_id)
      return
    }
  }
}

async function findGhlContact(email: string | null, phone: string | null): Promise<string | null> {
  for (const [field, value] of [['email', email], ['phone', phone]] as const) {
    if (!value) continue
    const r = await ghlFetch('/contacts/search', {
      method: 'POST',
      body: JSON.stringify({ locationId: FARMACIA_LOCATION_ID, pageLimit: 1, filters: [{ field, operator: 'eq', value }] }),
    })
    if (!r.ok) continue
    const j = (await r.json()) as { contacts?: Array<{ id: string }> }
    if (j.contacts?.[0]?.id) return j.contacts[0].id
  }
  return null
}

async function markCompleted(opId: string): Promise<void> {
  const sb = createAdminClient()
  await sb.from('farmacia_sync_queue').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', opId)
}

async function markPending(opId: string, delayMs: number, reason: string): Promise<void> {
  const sb = createAdminClient()
  await sb.from('farmacia_sync_queue').update({
    status: 'pending', next_attempt_at: new Date(Date.now() + delayMs).toISOString(), last_error: reason,
  }).eq('id', opId)
}

async function handleError(op: QueueRow, message: string): Promise<void> {
  const sb = createAdminClient()
  const attempts = (op.attempts ?? 0) + 1
  if (attempts >= MAX_ATTEMPTS) {
    await sb.from('farmacia_sync_queue').update({ status: 'failed', attempts, last_error: message.slice(0, 1000) }).eq('id', op.id)
    if (op.contact_id) await sb.from('farmacia_contacts').update({ sync_status: 'failed', sync_error: message.slice(0, 1000) }).eq('id', op.contact_id)
    return
  }
  const backoffMs = Math.min(MAX_BACKOFF_MS, Math.pow(2, attempts) * 1000)
  await sb.from('farmacia_sync_queue').update({
    status: 'pending', attempts, last_error: message.slice(0, 1000),
    next_attempt_at: new Date(Date.now() + backoffMs).toISOString(),
  }).eq('id', op.id)
}

async function maybeFlipToSynced(contactId: string): Promise<void> {
  const sb = createAdminClient()
  const { count } = await sb
    .from('farmacia_sync_queue')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', contactId)
    .in('status', ['pending', 'in_progress'])
  if ((count ?? 0) > 0) return
  await sb.from('farmacia_contacts').update({ sync_status: 'synced' }).eq('id', contactId).neq('sync_status', 'pending_delete')
}

export async function recoverStaleInProgress(staleMs: number = 5 * 60_000): Promise<number> {
  const sb = createAdminClient()
  const cutoff = new Date(Date.now() - staleMs).toISOString()
  const { data } = await sb
    .from('farmacia_sync_queue')
    .update({ status: 'pending', next_attempt_at: new Date().toISOString() })
    .eq('status', 'in_progress')
    .lt('last_attempt_at', cutoff)
    .select('id')
  return data?.length ?? 0
}

export async function countDuePending(): Promise<number> {
  const sb = createAdminClient()
  const { count } = await sb
    .from('farmacia_sync_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
  return count ?? 0
}
