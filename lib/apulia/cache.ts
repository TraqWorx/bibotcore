import { createAdminClient } from '@/lib/supabase-server'
import { fetchAllContacts, type ApuliaContact } from './contacts'
import { APULIA_FIELD, APULIA_TAG, getField } from './fields'

export type ApuliaSyncStatus =
  | 'synced'
  | 'pending_create'
  | 'pending_update'
  | 'pending_delete'
  | 'failed'

export interface CachedContactRow {
  id: string
  ghl_id: string | null
  sync_status: ApuliaSyncStatus
  email: string | null
  phone: string | null
  first_name: string | null
  last_name: string | null
  tags: string[]
  custom_fields: Record<string, string>
  pod_pdr: string | null
  codice_amministratore: string | null
  amministratore_name: string | null
  cliente: string | null
  comune: string | null
  stato: string | null
  compenso_per_pod: number | null
  pod_override: number | null
  commissione_totale: number | null
  is_amministratore: boolean
  is_switch_out: boolean
  ghl_updated_at: string | null
}

const COMUNE_FIELD_ID = 'EXO9WD4aLV2aPiMYxXUU' // Indirizzo (Città)

function num(v: string | undefined | null): number | null {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Some PODs / PDRs come out of Excel as scientific notation (e.g. "1.042E+13"
 * for a 13-digit number). Detect and expand to the integer form.
 */
export function normalizePod(v: string | null | undefined): string | null {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  if (/^[+-]?\d+(\.\d+)?[Ee][+-]?\d+$/.test(s)) {
    const n = Number(s)
    if (Number.isFinite(n)) return n.toFixed(0)
  }
  return s
}

/**
 * Build a cache row from a GHL contact payload.
 *
 * Sets `id` and `ghl_id` to the GHL contact id (legacy: existing rows hold
 * the GHL id as their PK). New Bibot-minted rows mint a uuid for `id` and
 * keep `ghl_id` null until the sync worker pushes them to GHL — those rows
 * are not produced here; this helper is for GHL → Bibot direction.
 */
export function cacheRowFromGhlContact(c: ApuliaContact): CachedContactRow {
  const cf: Record<string, string> = {}
  for (const f of c.customFields ?? []) {
    if (f.id && f.value != null) cf[f.id] = String(f.value)
  }
  const isAdmin = Boolean(c.tags?.includes(APULIA_TAG.AMMINISTRATORE))
  return {
    id: c.id,
    ghl_id: c.id,
    sync_status: 'synced',
    email: c.email ?? null,
    phone: c.phone ?? null,
    first_name: c.firstName ?? null,
    last_name: c.lastName ?? null,
    tags: c.tags ?? [],
    custom_fields: cf,
    pod_pdr: normalizePod(cf[APULIA_FIELD.POD_PDR]),
    codice_amministratore: cf[APULIA_FIELD.CODICE_AMMINISTRATORE] ?? null,
    amministratore_name: cf[APULIA_FIELD.AMMINISTRATORE_CONDOMINIO] ?? null,
    cliente: cf[APULIA_FIELD.CLIENTE] ?? c.firstName ?? null,
    comune: cf[COMUNE_FIELD_ID] ?? null,
    stato: cf[APULIA_FIELD.STATO] ?? null,
    compenso_per_pod: num(cf[APULIA_FIELD.COMPENSO_PER_POD]),
    pod_override: num(cf[APULIA_FIELD.POD_OVERRIDE]),
    commissione_totale: num(cf[APULIA_FIELD.COMMISSIONE_TOTALE]),
    is_amministratore: isAdmin,
    is_switch_out: Boolean(c.tags?.includes(APULIA_TAG.SWITCH_OUT)),
    ghl_updated_at: null,
  }
}

/** @deprecated Use cacheRowFromGhlContact. Kept for back-compat. */
export const toCacheRow = cacheRowFromGhlContact

/**
 * Full sync: reconciles apulia_contacts with whatever's currently in GHL.
 * Used as a safety net for missed webhooks (e.g. GHL bulk operations
 * that don't fan out per-contact events). Bibot is the source of truth,
 * so this routine is conservative:
 *
 *   - Rows where ghl_id IS NULL are in-flight Bibot creates — never
 *     touched.
 *   - Rows where sync_status IS NOT 'synced' are mid-mutation locally —
 *     never touched (the worker is about to push our version).
 *   - Existing rows matched by ghl_id get their fields refreshed.
 *   - GHL contacts with no Bibot match are inserted fresh (id=ghl_id
 *     legacy convention).
 *   - Rows whose ghl_id is no longer in GHL AND sync_status='synced'
 *     are deleted.
 *
 * Returns counts: total contacts seen in GHL, rows updated, rows
 * inserted, rows deleted.
 */
export async function fullSyncCache(): Promise<{ total: number; deleted: number; updated: number; inserted: number; skipped: number }> {
  const sb = createAdminClient()
  const all = await fetchAllContacts()
  const incoming = all.map(cacheRowFromGhlContact)

  // Pull existing rows we might match on (ghl_id-keyed map). Paginate
  // because PostgREST caps a single select at 1000 rows; without this
  // a partial map causes incoming rows to mis-classify as "new" and the
  // bulk INSERT fails with primary-key collisions on id=ghl_id.
  type ExistingRow = { id: string; ghl_id: string; sync_status: string }
  const existingRaw: ExistingRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from('apulia_contacts')
      .select('id, ghl_id, sync_status')
      .not('ghl_id', 'is', null)
      .range(from, from + 999)
    if (!data || data.length === 0) break
    existingRaw.push(...(data as ExistingRow[]))
    if (data.length < 1000) break
  }
  const byGhlId = new Map<string, ExistingRow>(existingRaw.map((r) => [r.ghl_id, r]))

  let updated = 0
  let inserted = 0
  let skipped = 0

  // Partition: existing-by-ghl_id (UPDATE), new (INSERT). Skip rows where
  // the local copy is mid-mutation.
  const updateRows: CachedContactRow[] = []
  const insertRows: CachedContactRow[] = []

  for (const row of incoming) {
    if (!row.ghl_id) continue // shouldn't happen — every GHL contact has an id
    const existing = byGhlId.get(row.ghl_id)
    if (existing) {
      if (existing.sync_status !== 'synced') { skipped++; continue }
      // UPDATE in place, preserving existing id (so apulia_payments FKs hold).
      updateRows.push({ ...row, id: existing.id })
      updated++
    } else {
      insertRows.push(row) // id == ghl_id (legacy convention, set by helper)
      inserted++
    }
  }

  const CHUNK = 500
  // UPDATEs via upsert(onConflict='id') — incoming row already keyed by
  // existing.id from the partition step.
  for (let i = 0; i < updateRows.length; i += CHUNK) {
    const slice = updateRows.slice(i, i + CHUNK)
    const { error } = await sb.from('apulia_contacts').upsert(slice, { onConflict: 'id' })
    if (error) throw new Error(`fullSyncCache update chunk ${i}: ${error.message}`)
  }
  for (let i = 0; i < insertRows.length; i += CHUNK) {
    const slice = insertRows.slice(i, i + CHUNK)
    const { error } = await sb.from('apulia_contacts').insert(slice)
    if (error) throw new Error(`fullSyncCache insert chunk ${i}: ${error.message}`)
  }

  // Stale detection: rows with ghl_id set but no longer present in GHL.
  // Only delete when sync_status='synced' — anything pending is mid-flight
  // and the worker will reconcile on its next attempt.
  const liveIds = new Set(incoming.map((r) => r.ghl_id).filter(Boolean) as string[])
  const stale = existingRaw
    .filter((r) => !liveIds.has(r.ghl_id) && r.sync_status === 'synced')
    .map((r) => r.id)
  let deleted = 0
  if (stale.length) {
    const { error } = await sb.from('apulia_contacts').delete().in('id', stale)
    if (!error) deleted = stale.length
  }

  return { total: incoming.length, deleted, updated, inserted, skipped }
}

/**
 * Upsert a cached contact from an inbound GHL record (webhook, lead API,
 * full sync). Identity follows ghl_id, never the row id:
 *
 *   1. Look up an existing row by ghl_id. If found, UPDATE it (preserving
 *      the row's `id` PK so apulia_payments FKs stay intact).
 *   2. Otherwise try to match an in-flight Bibot-created row (ghl_id IS
 *      NULL) by POD/PDR (condomini) or codice_amministratore (admins). If
 *      found, stamp ghl_id onto it and refresh its fields.
 *   3. Otherwise INSERT a new row, with id = ghl_id (legacy convention so
 *      payments FKs added before the refactor still resolve).
 */
export async function upsertCachedFromGhl(c: ApuliaContact): Promise<void> {
  const sb = createAdminClient()
  const row = cacheRowFromGhlContact(c)
  const ghlId = row.ghl_id
  if (!ghlId) throw new Error('upsertCachedFromGhl: missing ghl_id')

  // 1. Existing row by ghl_id?
  const { data: byGhlId } = await sb
    .from('apulia_contacts')
    .select('id')
    .eq('ghl_id', ghlId)
    .maybeSingle()

  if (byGhlId?.id) {
    const { id: _omit, ...rest } = row
    await sb.from('apulia_contacts').update(rest).eq('id', byGhlId.id)
    return
  }

  // 2. Fallback: in-flight Bibot row by POD/codice_amministratore.
  const cf: Record<string, string> = {}
  for (const f of c.customFields ?? []) {
    if (f.id && f.value != null) cf[f.id] = String(f.value)
  }
  const pod = normalizePod(cf[APULIA_FIELD.POD_PDR])
  const codice = cf[APULIA_FIELD.CODICE_AMMINISTRATORE] ?? null
  const isAdmin = Boolean(c.tags?.includes(APULIA_TAG.AMMINISTRATORE))

  let fallbackId: string | null = null
  if (isAdmin && codice) {
    const { data } = await sb
      .from('apulia_contacts')
      .select('id')
      .is('ghl_id', null)
      .eq('codice_amministratore', codice)
      .limit(1)
      .maybeSingle()
    fallbackId = data?.id ?? null
  } else if (pod) {
    const { data } = await sb
      .from('apulia_contacts')
      .select('id')
      .is('ghl_id', null)
      .eq('pod_pdr', pod)
      .limit(1)
      .maybeSingle()
    fallbackId = data?.id ?? null
  }

  if (fallbackId) {
    const { id: _omit, ...rest } = row
    await sb.from('apulia_contacts').update(rest).eq('id', fallbackId)
    return
  }

  // 3. Brand new — insert with id = ghl_id (legacy convention).
  await sb.from('apulia_contacts').insert(row)
}

/** Update a single field on the cache (avoids a full re-fetch). */
export async function patchCached(id: string, patch: Partial<CachedContactRow>): Promise<void> {
  const sb = createAdminClient()
  await sb.from('apulia_contacts').update(patch).eq('id', id)
}

/** Delete a single cached contact by row id (legacy callers). */
export async function deleteCached(id: string): Promise<void> {
  const sb = createAdminClient()
  await sb.from('apulia_contacts').delete().eq('id', id)
}

/**
 * Delete a cached contact by GHL id. Used by the GHL webhook delete path
 * so it works for both legacy rows (id == ghl_id) and any row reached via
 * the Bibot-minted-uuid path.
 */
export async function deleteCachedByGhlId(ghlId: string): Promise<void> {
  const sb = createAdminClient()
  await sb.from('apulia_contacts').delete().eq('ghl_id', ghlId)
}
