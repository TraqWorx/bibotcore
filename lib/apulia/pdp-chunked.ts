import { fetchAllContacts, indexByPodPdr, upsertContact, removeTag, type ApuliaContact, pmap } from './contacts'
import { APULIA_TAG } from './fields'

const COL = {
  PodPdr: 'POD/PDR',
  CodiceAmm: 'Fornitura : Cliente : Codice amministratore',
  Cliente: 'Cliente',
  Email: 'Fornitura : Dati di fatturazione : Email',
  Phone: 'Fornitura : Cliente : Numero di telefono',
  Mobile: 'Fornitura : Cliente : Numero di cellulare',
}

/** Compact view of an existing contact stored across chunk invocations. */
export interface CompactContact {
  id: string
  firstName?: string
  tags?: string[]
}

export interface PdpInitResult {
  /** Compact byPod map from the initial GHL fetch. */
  byPodInit: Record<string, CompactContact>
  /** Column → fieldId mapping used when building customFields. */
  colFieldMap: Record<string, string>
  /** Headers from the parsed file. */
  headers: string[]
}

/** Build the initial state once at the start of a PDP import. */
export async function initPdp(
  rows: Record<string, string>[],
  headers: string[],
  allFields: { id: string; name: string }[],
): Promise<PdpInitResult> {
  const fieldByName = new Map(allFields.map((f) => [f.name, f.id]))
  const colFieldMap: Record<string, string> = {}
  for (const h of headers) {
    const id = fieldByName.get(h)
    if (id) colFieldMap[h] = id
  }
  const existing = await fetchAllContacts()
  const byPod = indexByPodPdr(existing)
  const byPodInit: Record<string, CompactContact> = {}
  for (const [pod, c] of byPod) {
    byPodInit[pod] = { id: c.id, firstName: c.firstName, tags: c.tags }
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
  /** New entries to merge into the persisted createdInRun map. */
  newCreated: Record<string, CompactContact>
}

/**
 * Process one slice of PDP rows. Pure-ish: takes the current byPod view
 * (initial snapshot ∪ created-in-run), returns updated counters and the
 * new entries to merge before the next chunk.
 */
export async function processPdpChunk(
  rowsSlice: Record<string, string>[],
  colFieldMap: Record<string, string>,
  byPodView: Record<string, CompactContact>,
  prev: ChunkCounters,
): Promise<ChunkOutput> {
  const counters = { ...prev }
  const newCreated: Record<string, CompactContact> = {}

  await pmap(rowsSlice, async (row) => {
    const podRaw = (row[COL.PodPdr] || '').toUpperCase().trim()
    const pod = /^[+-]?\d+(\.\d+)?[Ee][+-]?\d+$/.test(podRaw)
      ? Number(podRaw).toFixed(0)
      : podRaw
    if (!pod) { counters.skipped++; return }

    const cliente = (row[COL.Cliente] || '').trim()
    const cf: Record<string, string | number> = {}
    for (const [colName, fieldId] of Object.entries(colFieldMap)) {
      const v = row[colName]
      if (v == null || v === '') continue
      cf[fieldId] = v
    }

    const existing = byPodView[pod]
    const wasSwitchedOut = existing?.tags?.includes(APULIA_TAG.SWITCH_OUT)

    try {
      if (existing) {
        await upsertContact({
          id: existing.id,
          firstName: cliente || existing.firstName,
          customField: cf,
        })
        if (wasSwitchedOut) {
          await removeTag(existing.id, APULIA_TAG.SWITCH_OUT)
          counters.untagged++
        }
        counters.updated++
      } else {
        const newId = await upsertContact({
          email: (row[COL.Email] || '').trim() || undefined,
          phone: sanitizePhone(row[COL.Mobile] || row[COL.Phone]),
          firstName: cliente || pod,
          customField: cf,
        })
        if (newId) {
          newCreated[pod] = { id: newId, firstName: cliente || pod, tags: [] }
          counters.created++
        }
      }
    } catch (err) {
      console.error(`[pdp-chunk] row failed (POD ${pod}):`, err)
      counters.unmatched++
    }
  }, 8)

  return { counters, newCreated }
}

/** Finalize: auto-create missing admins + recompute commissions. */
export async function finalizePdp(rows: Record<string, string>[], colFieldMap: Record<string, string>): Promise<{ adminCreates: number; recomputed: { admins: number; pods: number; podsActive: number; totalCommissionCents: number } }> {
  const { createAdminClient } = await import('@/lib/supabase-server')
  const { upsertContact } = await import('./contacts')
  const { upsertCachedFromGhl } = await import('./cache')
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
    const existingByCode = new Map((existingAdmins ?? []).map((a) => [a.codice_amministratore, a]))
    const now = new Date().toISOString()

    for (const [code, row] of firstRowByCode) {
      const existing = existingByCode.get(code)
      if (existing) {
        if (!existing.first_payment_at) {
          await sb.from('apulia_contacts').update({ first_payment_at: now }).eq('id', existing.id)
        }
        continue
      }
      const adminName = (row[COL_AdminName] || '').trim() || `Amministratore ${code}`
      const cf: Record<string, string | number> = {}
      for (const [colName, fieldId] of Object.entries(colFieldMap)) {
        const v = row[colName]
        if (v == null || v === '') continue
        cf[fieldId] = v
      }
      try {
        const newId = await upsertContact({
          email: (row[COL_AdminEmail] || '').trim() || undefined,
          phone: sanitizePhone(row[COL_AdminPhone]),
          firstName: adminName,
          tags: ['amministratore'],
          customField: cf,
        })
        if (newId) {
          await upsertCachedFromGhl({
            id: newId,
            firstName: adminName,
            tags: ['amministratore'],
            customFields: Object.entries(cf).map(([id, value]) => ({ id, value: String(value) })),
          })
          await sb.from('apulia_contacts').update({ first_payment_at: now }).eq('id', newId)
          adminCreates++
        }
      } catch (err) {
        console.error(`[pdp-finalize] auto-create admin ${code} failed:`, err)
      }
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

// Re-export type for callers
export type { ApuliaContact }
