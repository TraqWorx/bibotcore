import { ghlFetch, pmap } from './ghl'
import { fetchAllContacts, indexByCodiceAmministratore } from './contacts'
import { APULIA_FIELD, APULIA_TAG, getField } from './fields'

export interface RecomputeResult {
  admins: number
  pods: number
  podsActive: number
  totalCommissionCents: number
}

/**
 * Recompute "Commissione Totale" on every amministratore contact.
 *
 * For each admin: count their PODs (matched on Codice amministratore) that
 * are NOT switched-out. Per-POD amount = POD Override custom field if set,
 * else admin's compenso_per_pod. Sum and write back to the admin contact.
 */
export async function recomputeCommissions(): Promise<RecomputeResult> {
  const all = await fetchAllContacts()
  const admins = all.filter((c) => c.tags?.includes(APULIA_TAG.AMMINISTRATORE))
  const pods = all.filter((c) => !c.tags?.includes(APULIA_TAG.AMMINISTRATORE))
  const activePods = pods.filter((c) => !c.tags?.includes(APULIA_TAG.SWITCH_OUT))

  // Group active PODs by Codice amministratore.
  const byCode = new Map<string, { compenso: number; total: number; count: number }>()
  // First seed with each admin's compenso default.
  for (const a of admins) {
    const code = getField(a.customFields, APULIA_FIELD.CODICE_AMMINISTRATORE)?.trim()
    const compenso = num(getField(a.customFields, APULIA_FIELD.COMPENSO_PER_POD))
    if (code) byCode.set(code, { compenso, total: 0, count: 0 })
  }
  // Aggregate.
  for (const p of activePods) {
    const code = getField(p.customFields, APULIA_FIELD.CODICE_AMMINISTRATORE)?.trim()
    if (!code) continue
    const entry = byCode.get(code)
    if (!entry) continue
    const override = num(getField(p.customFields, APULIA_FIELD.POD_OVERRIDE))
    entry.total += override > 0 ? override : entry.compenso
    entry.count += 1
  }

  // Write back, only when value changed (cheap per-call avoidance).
  const adminsByCode = indexByCodiceAmministratore(admins)
  let totalSum = 0
  await pmap(
    [...byCode.entries()],
    async ([code, entry]) => {
      totalSum += entry.total
      const admin = adminsByCode.get(code)
      if (!admin) return
      const current = num(getField(admin.customFields, APULIA_FIELD.COMMISSIONE_TOTALE))
      // Cents-resolution comparison so trailing-zero floats don't flap.
      if (Math.round(current * 100) === Math.round(entry.total * 100)) return
      const r = await ghlFetch(`/contacts/${admin.id}`, {
        method: 'PUT',
        body: JSON.stringify({ customFields: [{ id: APULIA_FIELD.COMMISSIONE_TOTALE, value: entry.total }] }),
      })
      if (!r.ok) console.error(`[recompute] update ${admin.id}: ${r.status} ${await r.text()}`)
    },
    8,
  )

  return {
    admins: admins.length,
    pods: pods.length,
    podsActive: activePods.length,
    totalCommissionCents: Math.round(totalSum * 100),
  }
}

function num(v: string | undefined): number {
  if (!v) return 0
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
