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
  // GHL stores tags lowercased and webhooks them back lowercase, so a
  // case-sensitive .includes('Switch-out') against the tag we sent
  // ('Switch-out') would fail and flip is_switch_out back to false.
  // Compare on lowercased tags only.
  const tagsLower = (c.tags ?? []).map((t) => t.toLowerCase())
  const isAdmin = tagsLower.includes(APULIA_TAG.AMMINISTRATORE.toLowerCase())
  const isSwitchOut = tagsLower.includes(APULIA_TAG.SWITCH_OUT.toLowerCase())
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
    is_switch_out: isSwitchOut,
    ghl_updated_at: null,
  }
}

/** @deprecated Use cacheRowFromGhlContact. Kept for back-compat. */
export const toCacheRow = cacheRowFromGhlContact

/** Columns fullSyncCache writes, so it can read them back and compare. */
const SYNCED_COLUMNS =
  'id, ghl_id, sync_status, email, phone, first_name, last_name, tags, custom_fields, ' +
  'pod_pdr, codice_amministratore, amministratore_name, cliente, comune, stato, ' +
  'compenso_per_pod, pod_override, commissione_totale, is_amministratore, is_switch_out, ghl_updated_at'

function sameText(a: unknown, b: unknown): boolean {
  return (a ?? null) === (b ?? null)
}

function sameNumber(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return (a ?? null) === (b ?? null)
  return Number(a) === Number(b)
}

/** Tag order is whatever GHL returns, so compare the sets, not the arrays. */
function sameTags(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const x = [...(a ?? [])].sort()
  const y = [...(b ?? [])].sort()
  return x.length === y.length && x.every((v, i) => v === y[i])
}

/** jsonb comes back with its keys sorted; the incoming object's are in GHL order. */
function sameFields(a: Record<string, string> | null | undefined, b: Record<string, string> | null | undefined): boolean {
  const x = a ?? {}
  const y = b ?? {}
  const keys = Object.keys(x)
  if (keys.length !== Object.keys(y).length) return false
  return keys.every((k) => Object.prototype.hasOwnProperty.call(y, k) && String(x[k]) === String(y[k]))
}

/**
 * True when GHL's version of a contact matches the row we already hold, i.e.
 * an UPDATE would write the same bytes back. The hourly full sync re-reads all
 * ~4,000 contacts; writing every one of them cost ~100k row versions a day in
 * WAL, index churn and autovacuum on an instance whose disk throughput is the
 * bottleneck. Almost none of them have actually changed.
 */
export function sameCachedContact(existing: Partial<CachedContactRow>, incoming: CachedContactRow): boolean {
  return (
    sameText(existing.sync_status, incoming.sync_status) &&
    sameText(existing.email, incoming.email) &&
    sameText(existing.phone, incoming.phone) &&
    sameText(existing.first_name, incoming.first_name) &&
    sameText(existing.last_name, incoming.last_name) &&
    sameText(existing.pod_pdr, incoming.pod_pdr) &&
    sameText(existing.codice_amministratore, incoming.codice_amministratore) &&
    sameText(existing.amministratore_name, incoming.amministratore_name) &&
    sameText(existing.cliente, incoming.cliente) &&
    sameText(existing.comune, incoming.comune) &&
    sameText(existing.stato, incoming.stato) &&
    sameText(existing.ghl_updated_at, incoming.ghl_updated_at) &&
    sameNumber(existing.compenso_per_pod, incoming.compenso_per_pod) &&
    sameNumber(existing.pod_override, incoming.pod_override) &&
    sameNumber(existing.commissione_totale, incoming.commissione_totale) &&
    existing.is_amministratore === incoming.is_amministratore &&
    existing.is_switch_out === incoming.is_switch_out &&
    sameTags(existing.tags, incoming.tags) &&
    sameFields(existing.custom_fields, incoming.custom_fields)
  )
}

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
 *   - Existing rows matched by ghl_id get their fields refreshed, but only
 *     when a field actually differs (see sameCachedContact).
 *   - GHL contacts with no Bibot match are inserted fresh (id=ghl_id
 *     legacy convention).
 *   - Rows whose ghl_id is no longer in GHL AND sync_status='synced'
 *     are deleted.
 *
 * Returns counts: total contacts seen in GHL, rows updated, rows
 * inserted, rows deleted.
 */
export async function fullSyncCache(): Promise<{ total: number; deleted: number; updated: number; inserted: number; skipped: number; unchanged: number }> {
  const sb = createAdminClient()
  const all = await fetchAllContacts()
  // GHL paging can return the same contact twice; keep one row per ghl_id
  const incoming = [...new Map(all.map(cacheRowFromGhlContact).map((r) => [r.ghl_id, r])).values()]

  // An empty or truncated GHL response is indistinguishable from "everything
  // was deleted in GHL", and the stale step below would act on it. Bibot is
  // the source of truth here, so treat it as a failed fetch: raise, so the
  // caller records a failure and last_full_sync_at is not stamped.
  const { count: cachedCount } = await sb
    .from('apulia_contacts')
    .select('id', { count: 'exact', head: true })
    .not('ghl_id', 'is', null)
  if (incoming.length === 0 && (cachedCount ?? 0) > 0) {
    throw new Error(`GHL returned no contacts while ${cachedCount} are cached — refusing to empty the cache`)
  }

  // Pull existing rows we might match on (ghl_id-keyed map). Paginate
  // because PostgREST caps a single select at 1000 rows; without this
  // a partial map causes incoming rows to mis-classify as "new" and the
  // bulk INSERT fails with primary-key collisions on id=ghl_id.
  type ExistingRow = Partial<CachedContactRow> & { id: string; ghl_id: string; sync_status: string }
  const existingRaw: ExistingRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from('apulia_contacts')
      // Every column the upsert below writes, so unchanged rows can be left alone.
      .select(SYNCED_COLUMNS)
      .not('ghl_id', 'is', null)
      // Without a stable order, pages overlap and skip rows; a skipped row
      // then looks new and its INSERT hits apulia_contacts_ghl_id_unique.
      .order('id')
      .range(from, from + 999)
    if (!data || data.length === 0) break
    existingRaw.push(...(data as unknown as ExistingRow[]))
    if (data.length < 1000) break
  }
  const byGhlId = new Map<string, ExistingRow>(existingRaw.map((r) => [r.ghl_id, r]))

  let updated = 0
  let inserted = 0
  let skipped = 0
  let unchanged = 0

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
      const next = { ...row, id: existing.id }
      if (sameCachedContact(existing, next)) { unchanged++; continue }
      updateRows.push(next)
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
    if (!error) continue
    // A webhook can create the same contact between the read above and here.
    // ghl_id's unique index is partial, so ON CONFLICT can't target it: retry
    // row by row and skip rows that already exist.
    if (error.code !== '23505') throw new Error(`fullSyncCache insert chunk ${i}: ${error.message}`)
    for (const row of slice) {
      const { error: rowError } = await sb.from('apulia_contacts').insert(row)
      if (rowError?.code === '23505') { inserted--; skipped++; continue }
      if (rowError) throw new Error(`fullSyncCache insert ${row.ghl_id}: ${rowError.message}`)
    }
  }

  // Stale detection: rows with ghl_id set but no longer present in GHL.
  // Only delete when sync_status='synced' — anything pending is mid-flight
  // and the worker will reconcile on its next attempt.
  const liveIds = new Set(incoming.map((r) => r.ghl_id).filter(Boolean) as string[])
  const stale = existingRaw
    .filter((r) => !liveIds.has(r.ghl_id) && r.sync_status === 'synced')
    .map((r) => r.id)
  let deleted = 0
  // GHL's contact search pages with searchAfter and has been seen to stop
  // short; a short walk makes everything it missed look deleted. Deleting a
  // handful is routine, deleting a tenth of the client's book is not.
  const deleteCeiling = Math.max(50, Math.floor(existingRaw.length / 10))
  if (stale.length > deleteCeiling) {
    console.warn(`[fullSyncCache] ${stale.length} cached contacts absent from GHL (ceiling ${deleteCeiling}) — skipping deletions, GHL paging likely incomplete`)
  } else if (stale.length) {
    const { error } = await sb.from('apulia_contacts').delete().in('id', stale)
    if (!error) deleted = stale.length
  }

  await sb.from('apulia_sync_state').update({ last_full_sync_at: new Date().toISOString() }).eq('id', true)

  return { total: incoming.length, deleted, updated, inserted, skipped, unchanged }
}

/** How long a claimed sync may run before another caller may take over. */
const SYNC_LOCK_MINUTES = 15

export interface ApuliaSyncState {
  lastFullSyncAt: string | null
  runningSince: string | null
  /** Minutes since the last completed reconciliation (Infinity if never). */
  ageMinutes: number
  /** When an opportunities sync was last attempted (see migration 143). */
  opportunitiesSyncedAt: string | null
  opportunitiesAgeMinutes: number
}

export async function getApuliaSyncState(): Promise<ApuliaSyncState> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('apulia_sync_state')
    .select('last_full_sync_at, running_since, opportunities_synced_at')
    .eq('id', true)
    .maybeSingle()
  const last = data?.last_full_sync_at ?? null
  const opps = data?.opportunities_synced_at ?? null
  const minutesSince = (iso: string | null) =>
    iso ? (Date.now() - new Date(iso).getTime()) / 60000 : Number.POSITIVE_INFINITY
  return {
    lastFullSyncAt: last,
    runningSince: data?.running_since ?? null,
    ageMinutes: minutesSince(last),
    opportunitiesSyncedAt: opps,
    opportunitiesAgeMinutes: minutesSince(opps),
  }
}

/**
 * Stamp an opportunities sync ATTEMPT. Deliberately not conditional on the
 * sync finding anything: a location with no opportunities, or a GHL outage,
 * must not leave the page bootstrapping on every single view.
 */
export async function markOpportunitiesSynced(): Promise<void> {
  const sb = createAdminClient()
  await sb.from('apulia_sync_state').upsert({ id: true }, { onConflict: 'id', ignoreDuplicates: true })
  await sb.from('apulia_sync_state').update({ opportunities_synced_at: new Date().toISOString() }).eq('id', true)
}

/**
 * Run a full reconciliation unless one is already in flight. Returns null when
 * another run holds the claim — the caller should report "already running"
 * rather than starting a second GHL-wide pull.
 *
 * The claim is one UPDATE with its own WHERE, so two concurrent callers
 * serialize on the row and the loser matches nothing.
 */
export async function tryFullSyncCache(): Promise<Awaited<ReturnType<typeof fullSyncCache>> | null> {
  const sb = createAdminClient()
  const now = new Date()
  const staleLock = new Date(now.getTime() - SYNC_LOCK_MINUTES * 60_000).toISOString()

  // The single row is created by migration 139, but a database restored or
  // seeded without it would leave nothing for the claim to match, and every
  // reconciliation would report "already running" for ever.
  await sb.from('apulia_sync_state').upsert({ id: true }, { onConflict: 'id', ignoreDuplicates: true })

  const { data: claimed, error: claimError } = await sb
    .from('apulia_sync_state')
    .update({ running_since: now.toISOString() })
    .eq('id', true)
    .or(`running_since.is.null,running_since.lt.${staleLock}`)
    .select('id')
  // A failed claim is not the same as a claim someone else holds: raise, so
  // the caller reports an error instead of a quiet "already running".
  if (claimError) throw new Error(`claim apulia sync: ${claimError.message}`)
  if (!claimed || claimed.length === 0) return null

  try {
    return await fullSyncCache()
  } finally {
    await sb.from('apulia_sync_state').update({ running_since: null }).eq('id', true)
  }
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
  const tagsLowerFallback = (c.tags ?? []).map((t) => t.toLowerCase())
  const isAdmin = tagsLowerFallback.includes(APULIA_TAG.AMMINISTRATORE.toLowerCase())

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
