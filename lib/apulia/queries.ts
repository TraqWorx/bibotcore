import { createAdminClient } from '@/lib/supabase-server'
import { fetchAllContacts, type ApuliaContact } from './contacts'
import { APULIA_FIELD, APULIA_TAG, currentPeriod, getField } from './fields'

export interface AdminRow {
  contactId: string
  name: string
  email?: string
  phone?: string
  codiceAmministratore?: string
  compensoPerPod: number
  podsActive: number
  podsSwitchedOut: number
  total: number          // sum of (override || compenso) for active PODs
  paidThisPeriod: boolean
  paidAt?: string
}

export interface PodRow {
  contactId: string
  pod: string
  cliente?: string
  comune?: string
  switchedOut: boolean
  override: number
  amount: number          // override || admin.compensoPerPod
}

export interface ApuliaSnapshot {
  admins: ApuliaContact[]
  pods: ApuliaContact[]
  totalContacts: number
  totalAdmins: number
  totalPodsActive: number
  totalPodsSwitchedOut: number
  totalCommissionThisPeriod: number
}

export async function loadSnapshot(): Promise<ApuliaSnapshot> {
  const all = await fetchAllContacts()
  const admins = all.filter((c) => c.tags?.includes(APULIA_TAG.AMMINISTRATORE))
  const pods = all.filter((c) => !c.tags?.includes(APULIA_TAG.AMMINISTRATORE))
  const podsActive = pods.filter((p) => !p.tags?.includes(APULIA_TAG.SWITCH_OUT))
  const podsSwitchedOut = pods.filter((p) => p.tags?.includes(APULIA_TAG.SWITCH_OUT))

  let total = 0
  for (const a of admins) total += num(getField(a.customFields, APULIA_FIELD.COMMISSIONE_TOTALE))

  return {
    admins,
    pods,
    totalContacts: pods.length,
    totalAdmins: admins.length,
    totalPodsActive: podsActive.length,
    totalPodsSwitchedOut: podsSwitchedOut.length,
    totalCommissionThisPeriod: total,
  }
}

export async function listAdminsWithStats(): Promise<AdminRow[]> {
  const snap = await loadSnapshot()
  const period = currentPeriod()

  // Pre-load payments for current period
  const sb = createAdminClient()
  const { data: payments } = await sb
    .from('apulia_payments')
    .select('contact_id, paid_at')
    .eq('period', period)
    .in('contact_id', snap.admins.map((a) => a.id))
  const paidMap = new Map((payments ?? []).map((p) => [p.contact_id, p.paid_at]))

  // Group active PODs by code
  const byCode = new Map<string, { active: number; switched: number }>()
  for (const p of snap.pods) {
    const code = getField(p.customFields, APULIA_FIELD.CODICE_AMMINISTRATORE)?.trim()
    if (!code) continue
    if (!byCode.has(code)) byCode.set(code, { active: 0, switched: 0 })
    const e = byCode.get(code)!
    if (p.tags?.includes(APULIA_TAG.SWITCH_OUT)) e.switched++
    else e.active++
  }

  const rows: AdminRow[] = snap.admins.map((a) => {
    const code = getField(a.customFields, APULIA_FIELD.CODICE_AMMINISTRATORE)?.trim()
    const compenso = num(getField(a.customFields, APULIA_FIELD.COMPENSO_PER_POD))
    const total = num(getField(a.customFields, APULIA_FIELD.COMMISSIONE_TOTALE))
    const counts = (code && byCode.get(code)) || { active: 0, switched: 0 }
    const paidAt = paidMap.get(a.id)
    return {
      contactId: a.id,
      name: [a.firstName, a.lastName].filter(Boolean).join(' ') || a.email || '—',
      email: a.email,
      phone: a.phone,
      codiceAmministratore: code,
      compensoPerPod: compenso,
      podsActive: counts.active,
      podsSwitchedOut: counts.switched,
      total,
      paidThisPeriod: Boolean(paidAt),
      paidAt: paidAt ?? undefined,
    }
  })
  rows.sort((a, b) => b.total - a.total)
  return rows
}

export async function adminWithPods(adminContactId: string): Promise<{ admin: AdminRow | null; activePods: PodRow[]; switchedPods: PodRow[] }> {
  const snap = await loadSnapshot()
  const admin = snap.admins.find((a) => a.id === adminContactId)
  if (!admin) return { admin: null, activePods: [], switchedPods: [] }

  const code = getField(admin.customFields, APULIA_FIELD.CODICE_AMMINISTRATORE)?.trim()
  const compenso = num(getField(admin.customFields, APULIA_FIELD.COMPENSO_PER_POD))

  const minePods = code
    ? snap.pods.filter((p) => getField(p.customFields, APULIA_FIELD.CODICE_AMMINISTRATORE)?.trim() === code)
    : []

  function asPodRow(p: ApuliaContact): PodRow {
    const override = num(getField(p.customFields, APULIA_FIELD.POD_OVERRIDE))
    return {
      contactId: p.id,
      pod: getField(p.customFields, APULIA_FIELD.POD_PDR) ?? '—',
      cliente: p.firstName ?? getField(p.customFields, APULIA_FIELD.CLIENTE),
      comune: getField(p.customFields, '3oogUCrYWsdJScqe0jj4'), // place-holder; comune lives in another field
      switchedOut: Boolean(p.tags?.includes(APULIA_TAG.SWITCH_OUT)),
      override,
      amount: override > 0 ? override : compenso,
    }
  }

  const activePods = minePods.filter((p) => !p.tags?.includes(APULIA_TAG.SWITCH_OUT)).map(asPodRow)
  const switchedPods = minePods.filter((p) => p.tags?.includes(APULIA_TAG.SWITCH_OUT)).map(asPodRow)

  // Build the admin row (same shape as list)
  const list = await listAdminsWithStats()
  const adminRow = list.find((r) => r.contactId === adminContactId) ?? null

  return { admin: adminRow, activePods, switchedPods }
}

function num(v: string | undefined): number {
  if (!v) return 0
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
