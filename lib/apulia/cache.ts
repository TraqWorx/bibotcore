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
 * Full sync: pulls every contact from GHL, upserts the local cache,
 * deletes rows whose ghl_id is no longer present.
 *
 * Rows with `ghl_id IS NULL` are Bibot-minted creates that the worker
 * hasn't yet pushed to GHL — they're left untouched.
 */
export async function fullSyncCache(): Promise<{ total: number; deleted: number }> {
  const sb = createAdminClient()
  const all = await fetchAllContacts()
  const rows = all.map(cacheRowFromGhlContact)

  // Upsert by ghl_id. We can't use Supabase upsert(onConflict: 'ghl_id')
  // because that would also overwrite the row's `id` column for legacy rows
  // where id != ghl_id won't ever happen here (rows from GHL always have
  // id == ghl_id), but for in-flight rows that we match on POD/codice we'd
  // clobber their uuid. So we route through upsertCachedFromGhl one-by-one
  // for any row that could have a fallback match — and bulk-upsert the rest.
  //
  // For the bulk path: only rows that map cleanly to existing-by-ghl_id or
  // new-with-ghl_id-as-pk are safe.
  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await sb.from('apulia_contacts').upsert(chunk, { onConflict: 'id' })
    if (error) throw new Error(`cache upsert chunk ${i}: ${error.message}`)
  }

  // Delete stale rows that have a ghl_id no longer in GHL. Never touch rows
  // where ghl_id IS NULL — those are Bibot creates the worker hasn't pushed.
  const liveIds = new Set(rows.map((r) => r.ghl_id).filter(Boolean) as string[])
  const { data: cachedRows } = await sb
    .from('apulia_contacts')
    .select('id, ghl_id')
    .not('ghl_id', 'is', null)
  const stale = (cachedRows ?? [])
    .filter((r) => r.ghl_id && !liveIds.has(r.ghl_id))
    .map((r) => r.id)
  let deleted = 0
  if (stale.length) {
    const { error } = await sb.from('apulia_contacts').delete().in('id', stale)
    if (!error) deleted = stale.length
  }

  return { total: rows.length, deleted }
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
