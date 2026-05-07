import { createAdminClient } from '@/lib/supabase-server'
import { APULIA_FIELD } from './fields'
import { enqueueOps, type QueueOpInput } from './sync-queue'

export interface RecomputeResult {
  admins: number
  pods: number
  podsActive: number
  totalCommissionCents: number
}

/**
 * Recompute "Commissione Totale" on every amministratore — DB-first.
 *
 * Reads admins + pods from apulia_contacts, aggregates commissions per
 * codice_amministratore, writes back to the admin's commissione_totale
 * column when the value changed, and enqueues a 'set_field' op so the
 * worker pushes the new value to GHL.
 */
export async function recomputeCommissions(): Promise<RecomputeResult> {
  const sb = createAdminClient()

  // PostgREST caps a single select at 1000 rows. With several thousand
  // condomini we MUST paginate or the totals will be silently truncated
  // to whatever subset comes back.
  type AdminRow = {
    id: string
    ghl_id: string | null
    codice_amministratore: string | null
    compenso_per_pod: number | null
    commissione_totale: number | null
    custom_fields: Record<string, string> | null
  }
  type PodRow = {
    codice_amministratore: string | null
    pod_override: number | null
    is_switch_out: boolean
  }
  const admins: AdminRow[] = []
  const pods: PodRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('apulia_contacts')
      .select('id, ghl_id, codice_amministratore, compenso_per_pod, commissione_totale, custom_fields')
      .eq('is_amministratore', true)
      .neq('sync_status', 'pending_delete')
      .range(from, from + 999)
    if (!data || data.length === 0) break
    admins.push(...(data as AdminRow[]))
    if (data.length < 1000) break
  }
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('apulia_contacts')
      .select('codice_amministratore, pod_override, is_switch_out')
      .eq('is_amministratore', false)
      .neq('sync_status', 'pending_delete')
      .range(from, from + 999)
    if (!data || data.length === 0) break
    pods.push(...(data as PodRow[]))
    if (data.length < 1000) break
  }
  const activePods = pods.filter((p) => !p.is_switch_out)

  const byCode = new Map<string, { compenso: number; total: number; count: number }>()
  for (const a of admins) {
    if (a.codice_amministratore) {
      byCode.set(a.codice_amministratore, {
        compenso: Number(a.compenso_per_pod) || 0,
        total: 0,
        count: 0,
      })
    }
  }
  for (const p of activePods) {
    if (!p.codice_amministratore) continue
    const entry = byCode.get(p.codice_amministratore)
    if (!entry) continue
    const override = Number(p.pod_override) || 0
    entry.total += override > 0 ? override : entry.compenso
    entry.count += 1
  }

  const ops: QueueOpInput[] = []
  let totalSum = 0
  for (const a of admins) {
    if (!a.codice_amministratore) continue
    const entry = byCode.get(a.codice_amministratore)
    if (!entry) continue
    totalSum += entry.total
    const current = Number(a.commissione_totale) || 0
    if (Math.round(current * 100) === Math.round(entry.total * 100)) continue

    const newCf = { ...(a.custom_fields ?? {}), [APULIA_FIELD.COMMISSIONE_TOTALE]: String(entry.total) }
    await sb.from('apulia_contacts').update({
      commissione_totale: entry.total,
      custom_fields: newCf,
      sync_status: 'pending_update',
    }).eq('id', a.id)
    ops.push({
      contact_id: a.id,
      ghl_id: a.ghl_id ?? null,
      action: 'set_field',
      payload: { fieldId: APULIA_FIELD.COMMISSIONE_TOTALE, value: entry.total },
    })
  }

  await enqueueOps(ops)

  return {
    admins: admins.length,
    pods: pods.length,
    podsActive: activePods.length,
    totalCommissionCents: Math.round(totalSum * 100),
  }
}
