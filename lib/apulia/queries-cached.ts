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
  /** Anchor date — set on first PDP import where this admin matched. */
  firstPaymentAt?: string
  /** Next due date = anchor + paid_count * 6 months. */
  nextDueDate?: string
  /** Index of the next period to be paid (1, 2, 3 …). */
  nextPeriodIdx?: number
  /** True when the next due date is today or earlier. */
  isDueNow?: boolean
  /** How many periods are overdue (0 if none). */
  overdueCount?: number
  /** Mirrors apulia_contacts.sync_status (synced | pending_create | …). */
  syncStatus?: string
  /** Worker's last error message when sync_status='failed'. */
  syncError?: string | null
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
  /** Mirrors apulia_contacts.sync_status. */
  syncStatus?: string
  /** Worker's last error message when sync_status='failed'. */
  syncError?: string | null
}

export interface ApuliaSnapshot {
  totalAdmins: number
  totalPodsActive: number
  totalPodsSwitchedOut: number
  totalCommissionThisPeriod: number
}

/** Lightweight list for picker dropdowns: name + code only. */
export async function listAdminPickerOptions(): Promise<{ contactId: string; name: string; code: string }[]> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('apulia_contacts')
    .select('id, first_name, last_name, codice_amministratore')
    .eq('is_amministratore', true)
    .neq('sync_status', 'pending_delete')
    .not('codice_amministratore', 'is', null)
    .order('first_name')
  return ((data ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null; codice_amministratore: string | null }>)
    .filter((a) => a.codice_amministratore)
    .map((a) => ({
      contactId: a.id,
      name: [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Senza nome',
      code: a.codice_amministratore as string,
    }))
}

export async function loadSnapshot(): Promise<ApuliaSnapshot> {
  const sb = createAdminClient()
  const [{ count: totalAdmins }, { count: totalPodsActive }, { count: totalPodsSwitchedOut }, { data: admins }] = await Promise.all([
    sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', true).neq('sync_status', 'pending_delete'),
    sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('is_switch_out', false).neq('sync_status', 'pending_delete'),
    sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('is_switch_out', true).neq('sync_status', 'pending_delete'),
    sb.from('apulia_contacts').select('commissione_totale').eq('is_amministratore', true).neq('sync_status', 'pending_delete'),
  ])
  const total = (admins ?? []).reduce((s, a) => s + (Number(a.commissione_totale) || 0), 0)
  return {
    totalAdmins: totalAdmins ?? 0,
    totalPodsActive: totalPodsActive ?? 0,
    totalPodsSwitchedOut: totalPodsSwitchedOut ?? 0,
    totalCommissionThisPeriod: total,
  }
}

interface ScheduleRow {
  contact_id: string
  first_payment_at: string | null
  paid_count: number
  next_period_idx: number
  next_due_date: string | null
  is_due_now: boolean
  overdue_count: number
}

export async function listAdminsWithStats(): Promise<AdminRow[]> {
  const sb = createAdminClient()

  const [{ data: admins }, { data: podCounts }, { data: schedule }, { data: latestPayments }] = await Promise.all([
    sb.from('apulia_contacts').select('id, first_name, last_name, email, phone, codice_amministratore, compenso_per_pod, commissione_totale, sync_status, sync_error').eq('is_amministratore', true).neq('sync_status', 'pending_delete'),
    sb.rpc('apulia_admin_pod_counts'),
    sb.rpc('apulia_admin_schedule') as unknown as Promise<{ data: ScheduleRow[] | null }>,
    sb.from('apulia_payments').select('contact_id, paid_at').not('period_idx', 'is', null).order('paid_at', { ascending: false }),
  ])

  const countMap = new Map<string, { active: number; switched: number }>()
  for (const r of (podCounts ?? []) as Array<{ codice_amministratore: string; active: number; switched: number }>) {
    if (r.codice_amministratore) countMap.set(r.codice_amministratore, { active: Number(r.active), switched: Number(r.switched) })
  }
  const scheduleMap = new Map((schedule ?? []).map((s) => [s.contact_id, s]))
  const latestPaidMap = new Map<string, string>()
  for (const p of latestPayments ?? []) {
    if (!latestPaidMap.has(p.contact_id)) latestPaidMap.set(p.contact_id, p.paid_at as string)
  }

  const rows: AdminRow[] = (admins ?? []).map((a) => {
    const code = a.codice_amministratore ?? undefined
    const counts = (code && countMap.get(code)) || { active: 0, switched: 0 }
    const sched = scheduleMap.get(a.id)
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
      // "Paid this period" now means: the most recent due period has been paid.
      paidThisPeriod: sched ? sched.paid_count >= sched.next_period_idx - 1 && !sched.is_due_now : false,
      paidAt: latestPaidMap.get(a.id),
      firstPaymentAt: sched?.first_payment_at ?? undefined,
      nextDueDate: sched?.next_due_date ?? undefined,
      nextPeriodIdx: sched?.next_period_idx,
      isDueNow: sched?.is_due_now ?? false,
      overdueCount: sched?.overdue_count ?? 0,
      syncStatus: (a as { sync_status?: string }).sync_status ?? undefined,
      syncError: (a as { sync_error?: string | null }).sync_error ?? null,
    }
  })
  rows.sort((a, b) => b.total - a.total)
  return rows
}

export async function adminWithPods(adminContactId: string): Promise<{ admin: AdminRow | null; activePods: PodRow[]; switchedPods: PodRow[] }> {
  const sb = createAdminClient()
  const { data: a } = await sb.from('apulia_contacts').select('*').eq('id', adminContactId).neq('sync_status', 'pending_delete').maybeSingle()
  if (!a) return { admin: null, activePods: [], switchedPods: [] }
  const code = a.codice_amministratore as string | null
  const compenso = Number(a.compenso_per_pod) || 0

  let activePods: CachedContactRow[] = []
  let switchedPods: CachedContactRow[] = []
  if (code) {
    const [{ data: act }, { data: sw }] = await Promise.all([
      sb.from('apulia_contacts').select('*').eq('codice_amministratore', code).eq('is_amministratore', false).eq('is_switch_out', false).neq('sync_status', 'pending_delete').order('pod_pdr'),
      sb.from('apulia_contacts').select('*').eq('codice_amministratore', code).eq('is_amministratore', false).eq('is_switch_out', true).neq('sync_status', 'pending_delete').order('pod_pdr'),
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

  // Per-admin schedule (anchor + next due) from RPC.
  const { data: scheduleRows } = await sb.rpc('apulia_admin_schedule') as unknown as { data: ScheduleRow[] | null }
  const sched = (scheduleRows ?? []).find((s) => s.contact_id === adminContactId)
  const { data: latestPay } = await sb
    .from('apulia_payments')
    .select('paid_at')
    .eq('contact_id', adminContactId)
    .not('period_idx', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(1)
    .maybeSingle()

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
    paidThisPeriod: sched ? sched.paid_count >= sched.next_period_idx - 1 && !sched.is_due_now : false,
    paidAt: latestPay?.paid_at as string | undefined,
    firstPaymentAt: sched?.first_payment_at ?? undefined,
    nextDueDate: sched?.next_due_date ?? undefined,
    nextPeriodIdx: sched?.next_period_idx,
    isDueNow: sched?.is_due_now ?? false,
    overdueCount: sched?.overdue_count ?? 0,
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
    .neq('sync_status', 'pending_delete')

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
    sb.from('apulia_contacts').select('comune').eq('is_amministratore', false).neq('sync_status', 'pending_delete').not('comune', 'is', null).limit(2000),
    sb.from('apulia_contacts').select('amministratore_name').eq('is_amministratore', false).neq('sync_status', 'pending_delete').not('amministratore_name', 'is', null).limit(2000),
  ])
  const comuni = [...new Set((comuniRaw ?? []).map((r) => r.comune as string).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const amministratori = [...new Set((ammRaw ?? []).map((r) => r.amministratore_name as string).filter(Boolean))].sort((a, b) => a.localeCompare(b))

  const podRows: PodRow[] = ((rows ?? []) as Array<CachedContactRow & { sync_error?: string | null }>).map((r) => ({
    contactId: r.id,
    pod: r.pod_pdr ?? '—',
    cliente: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.cliente || undefined,
    comune: r.comune ?? undefined,
    stato: r.stato ?? undefined,
    amministratore: r.amministratore_name ?? undefined,
    switchedOut: r.is_switch_out,
    override: Number(r.pod_override) || 0,
    amount: 0,
    syncStatus: r.sync_status,
    syncError: r.sync_error ?? null,
  }))

  return { total: count ?? 0, rows: podRows, comuni, amministratori }
}
