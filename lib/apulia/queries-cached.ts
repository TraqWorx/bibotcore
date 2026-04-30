import { createAdminClient } from '@/lib/supabase-server'
import { currentPeriod } from './fields'
import type { CachedContactRow } from './cache'

export interface AdminRow {
  contactId: string
  name: string
  email?: string
  phone?: string
  codiceAmministratore?: string
  compensoPerPod: number
  podsActive: number
  podsSwitchedOut: number
  total: number
  paidThisPeriod: boolean
  paidAt?: string
}

export interface PodRow {
  contactId: string
  pod: string
  cliente?: string
  comune?: string
  stato?: string
  amministratore?: string
  switchedOut: boolean
  override: number
  amount: number
}

export interface ApuliaSnapshot {
  totalAdmins: number
  totalPodsActive: number
  totalPodsSwitchedOut: number
  totalCommissionThisPeriod: number
}

export async function loadSnapshot(): Promise<ApuliaSnapshot> {
  const sb = createAdminClient()
  const [{ count: totalAdmins }, { count: totalPodsActive }, { count: totalPodsSwitchedOut }, { data: admins }] = await Promise.all([
    sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', true),
    sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('is_switch_out', false),
    sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('is_switch_out', true),
    sb.from('apulia_contacts').select('commissione_totale').eq('is_amministratore', true),
  ])
  const total = (admins ?? []).reduce((s, a) => s + (Number(a.commissione_totale) || 0), 0)
  return {
    totalAdmins: totalAdmins ?? 0,
    totalPodsActive: totalPodsActive ?? 0,
    totalPodsSwitchedOut: totalPodsSwitchedOut ?? 0,
    totalCommissionThisPeriod: total,
  }
}

export async function listAdminsWithStats(): Promise<AdminRow[]> {
  const sb = createAdminClient()
  const period = currentPeriod()

  const [{ data: admins }, { data: podCounts }, { data: payments }] = await Promise.all([
    sb.from('apulia_contacts').select('id, first_name, last_name, email, phone, codice_amministratore, compenso_per_pod, commissione_totale').eq('is_amministratore', true),
    sb.rpc('apulia_admin_pod_counts'),
    sb.from('apulia_payments').select('contact_id, paid_at').eq('period', period),
  ])

  const paidMap = new Map((payments ?? []).map((p) => [p.contact_id, p.paid_at as string]))
  const countMap = new Map<string, { active: number; switched: number }>()
  for (const r of (podCounts ?? []) as Array<{ codice_amministratore: string; active: number; switched: number }>) {
    if (r.codice_amministratore) countMap.set(r.codice_amministratore, { active: Number(r.active), switched: Number(r.switched) })
  }

  const rows: AdminRow[] = (admins ?? []).map((a) => {
    const code = a.codice_amministratore ?? undefined
    const counts = (code && countMap.get(code)) || { active: 0, switched: 0 }
    return {
      contactId: a.id,
      name: [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || '—',
      email: a.email ?? undefined,
      phone: a.phone ?? undefined,
      codiceAmministratore: code,
      compensoPerPod: Number(a.compenso_per_pod) || 0,
      podsActive: counts.active,
      podsSwitchedOut: counts.switched,
      total: Number(a.commissione_totale) || 0,
      paidThisPeriod: paidMap.has(a.id),
      paidAt: paidMap.get(a.id),
    }
  })
  rows.sort((a, b) => b.total - a.total)
  return rows
}

export async function adminWithPods(adminContactId: string): Promise<{ admin: AdminRow | null; activePods: PodRow[]; switchedPods: PodRow[] }> {
  const sb = createAdminClient()
  const { data: a } = await sb.from('apulia_contacts').select('*').eq('id', adminContactId).single()
  if (!a) return { admin: null, activePods: [], switchedPods: [] }
  const code = a.codice_amministratore as string | null
  const compenso = Number(a.compenso_per_pod) || 0

  let activePods: CachedContactRow[] = []
  let switchedPods: CachedContactRow[] = []
  if (code) {
    const [{ data: act }, { data: sw }] = await Promise.all([
      sb.from('apulia_contacts').select('*').eq('codice_amministratore', code).eq('is_amministratore', false).eq('is_switch_out', false).order('pod_pdr'),
      sb.from('apulia_contacts').select('*').eq('codice_amministratore', code).eq('is_amministratore', false).eq('is_switch_out', true).order('pod_pdr'),
    ])
    activePods = (act ?? []) as CachedContactRow[]
    switchedPods = (sw ?? []) as CachedContactRow[]
  }

  function asPodRow(p: CachedContactRow): PodRow {
    const override = Number(p.pod_override) || 0
    return {
      contactId: p.id,
      pod: p.pod_pdr ?? '—',
      cliente: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.cliente || undefined,
      comune: p.comune ?? undefined,
      stato: p.stato ?? undefined,
      amministratore: p.amministratore_name ?? undefined,
      switchedOut: p.is_switch_out,
      override,
      amount: override > 0 ? override : compenso,
    }
  }

  // Period-paid status from apulia_payments
  const period = currentPeriod()
  const { data: pay } = await sb.from('apulia_payments').select('paid_at').eq('contact_id', adminContactId).eq('period', period).maybeSingle()

  const adminRow: AdminRow = {
    contactId: a.id,
    name: [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || '—',
    email: a.email ?? undefined,
    phone: a.phone ?? undefined,
    codiceAmministratore: code ?? undefined,
    compensoPerPod: compenso,
    podsActive: activePods.length,
    podsSwitchedOut: switchedPods.length,
    total: Number(a.commissione_totale) || 0,
    paidThisPeriod: Boolean(pay),
    paidAt: pay?.paid_at as string | undefined,
  }

  return { admin: adminRow, activePods: activePods.map(asPodRow), switchedPods: switchedPods.map(asPodRow) }
}

export interface CondominiFilters {
  q?: string
  stato?: 'active' | 'switch_out'
  comune?: string
  amministratore?: string
  page?: number
  pageSize?: number
}

export interface CondominiResult {
  total: number
  rows: PodRow[]
  comuni: string[]
  amministratori: string[]
}

export async function listCondomini(f: CondominiFilters): Promise<CondominiResult> {
  const sb = createAdminClient()
  const pageSize = f.pageSize ?? 50
  const page = Math.max(1, f.page ?? 1)

  let q = sb
    .from('apulia_contacts')
    .select('*', { count: 'exact' })
    .eq('is_amministratore', false)

  if (f.stato === 'active') q = q.eq('is_switch_out', false)
  else if (f.stato === 'switch_out') q = q.eq('is_switch_out', true)
  if (f.comune) q = q.ilike('comune', f.comune)
  if (f.amministratore) q = q.ilike('amministratore_name', `%${f.amministratore}%`)
  if (f.q) {
    const term = f.q.replace(/[%_]/g, ' ')
    q = q.or([
      `pod_pdr.ilike.%${term}%`,
      `cliente.ilike.%${term}%`,
      `first_name.ilike.%${term}%`,
      `last_name.ilike.%${term}%`,
      `amministratore_name.ilike.%${term}%`,
    ].join(','))
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  q = q.order('pod_pdr', { ascending: true, nullsFirst: false }).range(from, to)

  const { data: rows, count } = await q

  // Distinct comuni / amministratori for filter dropdowns.
  const [{ data: comuniRaw }, { data: ammRaw }] = await Promise.all([
    sb.from('apulia_contacts').select('comune').eq('is_amministratore', false).not('comune', 'is', null).limit(2000),
    sb.from('apulia_contacts').select('amministratore_name').eq('is_amministratore', false).not('amministratore_name', 'is', null).limit(2000),
  ])
  const comuni = [...new Set((comuniRaw ?? []).map((r) => r.comune as string).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const amministratori = [...new Set((ammRaw ?? []).map((r) => r.amministratore_name as string).filter(Boolean))].sort((a, b) => a.localeCompare(b))

  const podRows: PodRow[] = ((rows ?? []) as CachedContactRow[]).map((r) => ({
    contactId: r.id,
    pod: r.pod_pdr ?? '—',
    cliente: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.cliente || undefined,
    comune: r.comune ?? undefined,
    stato: r.stato ?? undefined,
    amministratore: r.amministratore_name ?? undefined,
    switchedOut: r.is_switch_out,
    override: Number(r.pod_override) || 0,
    amount: 0,
  }))

  return { total: count ?? 0, rows: podRows, comuni, amministratori }
}
