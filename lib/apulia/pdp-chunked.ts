import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase-server'
import { APULIA_FIELD, APULIA_TAG } from './fields'
import { normalizePod } from './cache'
import { enqueueOps, type QueueOpInput } from './sync-queue'

const COL = {
  PodPdr: 'POD/PDR',
  CodiceAmm: 'Fornitura : Cliente : Codice amministratore',
  Cliente: 'Cliente',
  Email: 'Fornitura : Dati di fatturazione : Email',
  Phone: 'Fornitura : Cliente : Numero di telefono',
  Mobile: 'Fornitura : Cliente : Numero di cellulare',
}

const COMUNE_FIELD_ID = 'EXO9WD4aLV2aPiMYxXUU'

/** Compact existing-row view kept for backwards compat with any older callers. */
export interface CompactContact {
  id: string
  firstName?: string
  tags?: string[]
}

export interface PdpInitResult {
  byPodInit: Record<string, CompactContact>
  colFieldMap: Record<string, string>
  headers: string[]
}

/**
 * Initial state needed by the import. Pure-DB now — no GHL fetch.
 */
export async function initPdp(
  _rows: Record<string, string>[],
  headers: string[],
  allFields: { id: string; name: string }[],
): Promise<PdpInitResult> {
  const fieldByName = new Map(allFields.map((f) => [f.name, f.id]))
  const colFieldMap: Record<string, string> = {}
  for (const h of headers) {
    const id = fieldByName.get(h)
    if (id) colFieldMap[h] = id
  }
  const sb = createAdminClient()
  // Paginate — PostgREST caps a single select at 1000 rows. Without
  // this, byPodInit would only know about the first 1000 condomini and
  // cross-chunk dedup of file rows pointing at existing PODs would fail
  // for everything past that cut-off, producing duplicate inserts.
  const byPodInit: Record<string, CompactContact> = {}
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from('apulia_contacts')
      .select('id, first_name, tags, pod_pdr')
      .eq('is_amministratore', false)
      .not('pod_pdr', 'is', null)
      .range(from, from + 999)
    if (!data || data.length === 0) break
    for (const r of data) {
      if (r.pod_pdr) byPodInit[String(r.pod_pdr)] = {
        id: String(r.id),
        firstName: r.first_name ?? undefined,
        tags: (r.tags as string[] | null) ?? [],
      }
    }
    if (data.length < 1000) break
  }
  return { byPodInit, colFieldMap, headers }
}

export interface ChunkCounters {
  created: number
  updated: number
  untagged: number
  unmatched: number
  skipped: number
}

export interface ChunkOutput {
  counters: ChunkCounters
  newCreated: Record<string, CompactContact>
  rateLimited?: boolean
  processedCount?: number
}

/**
 * DB-first PDP chunk processor. Writes go straight to apulia_contacts and
 * the corresponding queue ops are pushed onto apulia_sync_queue. There is
 * no GHL traffic here — the worker drains the queue.
 *
 * `byPodView` is consulted first so cross-chunk creates within a single
 * import don't double-mint rows for the same POD.
 */
export async function processPdpChunk(
  rowsSlice: Record<string, string>[],
  colFieldMap: Record<string, string>,
  byPodView: Record<string, CompactContact>,
  prev: ChunkCounters,
  importId?: string | null,
): Promise<ChunkOutput> {
  const counters = { ...prev }
  const newCreated: Record<string, CompactContact> = {}

  // Existing rows in this chunk that we need to UPDATE: pull their full
  // current shape so we can merge custom_fields without losing prior keys.
  const podsInSlice: string[] = []
  for (const row of rowsSlice) {
    const pod = normalizePod((row[COL.PodPdr] || '').toUpperCase().trim())
    if (pod) podsInSlice.push(pod)
  }
  const sb = createAdminClient()
  const existingMap = new Map<string, ExistingRow>()
  if (podsInSlice.length) {
    const { data } = await sb
      .from('apulia_contacts')
      .select('id, ghl_id, first_name, tags, custom_fields, is_switch_out, pod_pdr')
      .neq('sync_status', 'pending_delete')
      .in('pod_pdr', podsInSlice)
    for (const r of (data ?? []) as ExistingRow[]) {
      if (r.pod_pdr) existingMap.set(r.pod_pdr, r)
    }
  }

  const inserts: NewRow[] = []
  const updates: UpdatedRow[] = []
  const ops: QueueOpInput[] = []
  let processedCount = 0

  for (const row of rowsSlice) {
    const pod = normalizePod((row[COL.PodPdr] || '').toUpperCase().trim())
    if (!pod) { counters.skipped++; processedCount++; continue }

    const cliente = (row[COL.Cliente] || '').trim()
    const cf: Record<string, string> = {}
    for (const [colName, fieldId] of Object.entries(colFieldMap)) {
      const v = row[colName]
      if (v == null || v === '') continue
      cf[fieldId] = String(v)
    }

    // Cross-chunk dedupe: if a previous chunk already inserted this POD in
    // the same run, treat as existing and update via the row id we minted.
    const fromPrior = byPodView[pod]
    const existing = existingMap.get(pod) ?? (fromPrior
      ? { id: fromPrior.id, ghl_id: null, first_name: fromPrior.firstName ?? null, tags: fromPrior.tags ?? [], custom_fields: {}, is_switch_out: false }
      : null)

    if (existing) {
      const mergedCf: Record<string, string> = { ...(existing.custom_fields ?? {}), ...cf }
      const tags = (existing.tags ?? []).filter((t) => t !== APULIA_TAG.SWITCH_OUT)
      const wasSwitchedOut = existing.is_switch_out

      updates.push({
        id: existing.id,
        first_name: cliente || existing.first_name,
        tags,
        custom_fields: mergedCf,
        pod_pdr: pod,
        codice_amministratore: mergedCf[APULIA_FIELD.CODICE_AMMINISTRATORE] ?? null,
        amministratore_name: mergedCf[APULIA_FIELD.AMMINISTRATORE_CONDOMINIO] ?? null,
        cliente: mergedCf[APULIA_FIELD.CLIENTE] ?? cliente ?? null,
        comune: mergedCf[COMUNE_FIELD_ID] ?? null,
        stato: mergedCf[APULIA_FIELD.STATO] ?? null,
        is_switch_out: false,
        sync_status: 'pending_update',
      })
      ops.push({
        contact_id: existing.id,
        ghl_id: existing.ghl_id ?? null,
        action: 'update',
      })
      if (wasSwitchedOut) {
        ops.push({
          contact_id: existing.id,
          ghl_id: existing.ghl_id ?? null,
          action: 'remove_tag',
          payload: { tag: APULIA_TAG.SWITCH_OUT },
        })
        counters.untagged++
      }
      counters.updated++
    } else {
      const id = randomUUID()
      const inserted: NewRow = {
        id,
        ghl_id: null,
        sync_status: 'pending_create',
        email: ((row[COL.Email] || '').trim()) || null,
        phone: sanitizePhone(row[COL.Mobile] || row[COL.Phone]) ?? null,
        first_name: cliente || pod,
        last_name: null,
        tags: [],
        custom_fields: cf,
        pod_pdr: pod,
        codice_amministratore: cf[APULIA_FIELD.CODICE_AMMINISTRATORE] ?? null,
        amministratore_name: cf[APULIA_FIELD.AMMINISTRATORE_CONDOMINIO] ?? null,
        cliente: cliente || null,
        comune: cf[COMUNE_FIELD_ID] ?? null,
        stato: cf[APULIA_FIELD.STATO] ?? null,
        compenso_per_pod: null,
        pod_override: num(cf[APULIA_FIELD.POD_OVERRIDE]),
        commissione_totale: null,
        is_amministratore: false,
        is_switch_out: false,
        ghl_updated_at: null,
      }
      inserts.push(inserted)
      ops.push({ contact_id: id, ghl_id: null, action: 'create' })
      newCreated[pod] = { id, firstName: cliente || pod, tags: [] }
      counters.created++
    }
    processedCount++
  }

  // Defensive dedup: two file rows pointing at the same Bibot row would
  // produce two upsert entries with the same id, which Postgres rejects
  // ("ON CONFLICT DO UPDATE command cannot affect row a second time").
  // Same for two new rows with the same POD. Collapse: last write wins,
  // but custom_fields are merged so we don't lose data from earlier rows.
  const updatesById = new Map<string, UpdatedRow>()
  for (const u of updates) {
    const prev = updatesById.get(u.id)
    if (prev) u.custom_fields = { ...prev.custom_fields, ...u.custom_fields }
    updatesById.set(u.id, u)
  }
  const insertsByPod = new Map<string, NewRow>()
  const droppedInserts: NewRow[] = []
  for (const ins of inserts) {
    const pod = ins.pod_pdr
    if (!pod) continue
    const prev = insertsByPod.get(pod)
    if (prev) {
      // Same POD already pending insert — fold this row's data in (so
      // later columns from the file don't get lost) and drop this row.
      prev.custom_fields = { ...prev.custom_fields, ...ins.custom_fields }
      droppedInserts.push(ins)
      continue
    }
    insertsByPod.set(pod, ins)
  }
  // Drop ops for collapsed inserts so the queue doesn't reference dead ids.
  if (droppedInserts.length > 0) {
    const droppedIds = new Set(droppedInserts.map((r) => r.id))
    for (let i = ops.length - 1; i >= 0; i--) {
      if (droppedIds.has(ops[i].contact_id)) ops.splice(i, 1)
    }
    counters.created -= droppedInserts.length
  }

  // Persist DB writes in chunks.
  const finalInserts = [...insertsByPod.values()]
  const finalUpdates = [...updatesById.values()]
  const CHUNK = 500
  if (finalInserts.length) {
    for (let i = 0; i < finalInserts.length; i += CHUNK) {
      const slice = finalInserts.slice(i, i + CHUNK)
      const { error } = await sb.from('apulia_contacts').insert(slice)
      if (error) throw new Error(`pdp insert ${i}: ${error.message}`)
    }
  }
  if (finalUpdates.length) {
    for (let i = 0; i < finalUpdates.length; i += CHUNK) {
      const slice = finalUpdates.slice(i, i + CHUNK)
      const { error } = await sb.from('apulia_contacts').upsert(slice, { onConflict: 'id' })
      if (error) throw new Error(`pdp update ${i}: ${error.message}`)
    }
  }
  await enqueueOps(ops, importId ?? null)

  return { counters, newCreated, rateLimited: false, processedCount }
}

/**
 * Auto-create any admins referenced in the PDP whose codice_amministratore
 * isn't already in the DB. New admins are minted in apulia_contacts with
 * sync_status='pending_create' and a 'create' op enqueued. Existing admins
 * have their first_payment_at stamped if it isn't set.
 *
 * Recompute commissions runs at the end (DB-only).
 */
export async function finalizePdp(
  rows: Record<string, string>[],
  colFieldMap: Record<string, string>,
  importId?: string | null,
): Promise<{ adminCreates: number; recomputed: import('./recompute').RecomputeResult }> {
  const { recomputeCommissions } = await import('./recompute')
  const sb = createAdminClient()

  const COL_AdminName = 'Fornitura : Cliente : Amministratore condominio'
  const COL_AdminEmail = 'Fornitura : Dati di fatturazione : Email'
  const COL_AdminPhone = 'Fornitura : Cliente : Numero Telefono Amministratore'
  const COL_CodiceAmm = 'Fornitura : Cliente : Codice amministratore'

  const firstRowByCode = new Map<string, Record<string, string>>()
  for (const row of rows) {
    const code = (row[COL_CodiceAmm] || '').trim()
    if (code && !firstRowByCode.has(code)) firstRowByCode.set(code, row)
  }

  let adminCreates = 0
  if (firstRowByCode.size > 0) {
    const { data: existingAdmins } = await sb
      .from('apulia_contacts')
      .select('id, codice_amministratore, first_payment_at')
      .eq('is_amministratore', true)
      .in('codice_amministratore', [...firstRowByCode.keys()])
    const existingByCode = new Map(((existingAdmins ?? []) as ExistingAdmin[]).map((a) => [a.codice_amministratore, a]))
    const now = new Date().toISOString()

    const newAdmins: NewRow[] = []
    const ops: QueueOpInput[] = []

    for (const [code, row] of firstRowByCode) {
      const existing = existingByCode.get(code)
      if (existing) {
        if (!existing.first_payment_at) {
          await sb.from('apulia_contacts').update({ first_payment_at: now }).eq('id', existing.id)
        }
        continue
      }
      const adminName = (row[COL_AdminName] || '').trim() || `Amministratore ${code}`
      const cf: Record<string, string> = {}
      for (const [colName, fieldId] of Object.entries(colFieldMap)) {
        const v = row[colName]
        if (v == null || v === '') continue
        cf[fieldId] = String(v)
      }
      cf[APULIA_FIELD.AMMINISTRATORE_CONDOMINIO] = adminName
      cf[APULIA_FIELD.CODICE_AMMINISTRATORE] = code

      const id = randomUUID()
      newAdmins.push({
        id,
        ghl_id: null,
        sync_status: 'pending_create',
        email: ((row[COL_AdminEmail] || '').trim()) || null,
        phone: sanitizePhone(row[COL_AdminPhone]) ?? null,
        first_name: adminName,
        last_name: null,
        tags: [APULIA_TAG.AMMINISTRATORE],
        custom_fields: cf,
        pod_pdr: null,
        codice_amministratore: code,
        amministratore_name: adminName,
        cliente: null,
        comune: null,
        stato: null,
        compenso_per_pod: null,
        pod_override: null,
        commissione_totale: null,
        is_amministratore: true,
        is_switch_out: false,
        ghl_updated_at: null,
      })
      ops.push({ contact_id: id, ghl_id: null, action: 'create' })
      adminCreates++
    }

    if (newAdmins.length) {
      const CHUNK = 500
      for (let i = 0; i < newAdmins.length; i += CHUNK) {
        const slice = newAdmins.slice(i, i + CHUNK)
        const { error } = await sb.from('apulia_contacts').insert(slice)
        if (error) throw new Error(`finalize admin insert: ${error.message}`)
      }
      // Stamp first_payment_at on the same set in a follow-up update so it
      // isn't part of the bulk insert (column lives outside CachedContactRow).
      const ids = newAdmins.map((r) => r.id)
      await sb.from('apulia_contacts').update({ first_payment_at: now }).in('id', ids)
      await enqueueOps(ops, importId ?? null)
    }
  }

  const recomputed = await recomputeCommissions()
  return { adminCreates, recomputed }
}

function sanitizePhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const digits = String(raw).replace(/[^\d+]/g, '')
  if (!digits || /^0+$/.test(digits)) return undefined
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('00')) return '+' + digits.slice(2)
  if (digits.startsWith('39')) return '+' + digits
  return '+39' + digits
}

function num(v: string | undefined | null): number | null {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

interface ExistingRow {
  id: string
  ghl_id: string | null
  first_name: string | null
  tags: string[] | null
  custom_fields: Record<string, string> | null
  is_switch_out: boolean
  pod_pdr: string | null
}

interface ExistingAdmin {
  id: string
  codice_amministratore: string
  first_payment_at: string | null
}

interface NewRow {
  id: string
  ghl_id: string | null
  sync_status: 'pending_create'
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

interface UpdatedRow {
  id: string
  first_name: string | null
  tags: string[]
  custom_fields: Record<string, string>
  pod_pdr: string
  codice_amministratore: string | null
  amministratore_name: string | null
  cliente: string | null
  comune: string | null
  stato: string | null
  is_switch_out: boolean
  sync_status: 'pending_update'
}

export type { ApuliaContact } from './contacts'
