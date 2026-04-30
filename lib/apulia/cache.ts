import { createAdminClient } from '@/lib/supabase-server'
import { fetchAllContacts, type ApuliaContact } from './contacts'
import { APULIA_FIELD, APULIA_TAG, getField } from './fields'

export interface CachedContactRow {
  id: string
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

export function toCacheRow(c: ApuliaContact): CachedContactRow {
  const cf: Record<string, string> = {}
  for (const f of c.customFields ?? []) {
    if (f.id && f.value != null) cf[f.id] = String(f.value)
  }
  const isAdmin = Boolean(c.tags?.includes(APULIA_TAG.AMMINISTRATORE))
  return {
    id: c.id,
    email: c.email ?? null,
    phone: c.phone ?? null,
    first_name: c.firstName ?? null,
    last_name: c.lastName ?? null,
    tags: c.tags ?? [],
    custom_fields: cf,
    pod_pdr: cf[APULIA_FIELD.POD_PDR] ?? null,
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

/**
 * Full sync: pulls every contact from GHL, upserts the local cache,
 * deletes rows whose ids are no longer present.
 */
export async function fullSyncCache(): Promise<{ total: number; deleted: number }> {
  const sb = createAdminClient()
  const all = await fetchAllContacts()
  const rows = all.map(toCacheRow)

  // Upsert in chunks (Supabase recommends ≤1000 rows per call).
  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await sb.from('apulia_contacts').upsert(chunk, { onConflict: 'id' })
    if (error) throw new Error(`cache upsert chunk ${i}: ${error.message}`)
  }

  // Delete stale rows.
  const liveIds = new Set(rows.map((r) => r.id))
  const { data: cachedIds } = await sb.from('apulia_contacts').select('id')
  const stale = (cachedIds ?? []).map((r) => r.id).filter((id) => !liveIds.has(id))
  let deleted = 0
  if (stale.length) {
    const { error } = await sb.from('apulia_contacts').delete().in('id', stale)
    if (!error) deleted = stale.length
  }

  return { total: rows.length, deleted }
}

/** Update one cached contact from a GHL record. */
export async function upsertCachedFromGhl(c: ApuliaContact): Promise<void> {
  const sb = createAdminClient()
  await sb.from('apulia_contacts').upsert(toCacheRow(c), { onConflict: 'id' })
}

/** Update a single field on the cache (avoids a full re-fetch). */
export async function patchCached(id: string, patch: Partial<CachedContactRow>): Promise<void> {
  const sb = createAdminClient()
  await sb.from('apulia_contacts').update(patch).eq('id', id)
}

/** Delete a single cached contact. */
export async function deleteCached(id: string): Promise<void> {
  const sb = createAdminClient()
  await sb.from('apulia_contacts').delete().eq('id', id)
}
