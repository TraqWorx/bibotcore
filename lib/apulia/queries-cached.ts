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
  /** When this row was first cached in Bibot (cached_at, set on insert). */
  addedAt?: string
  /** Last time this POD was marked paid. */
  lastPaidAt?: string
  /** When this POD comes due again: lastPaidAt + 6mo, or addedAt for new PODs. */
  nextDueDate?: string
  /** 'paid' = within 6mo of last payment; 'due' = unpaid or cycle elapsed. */
  paymentStatus?: 'paid' | 'due'
  /** Number of payments recorded for this POD over its lifetime. */
  paidCount?: number
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

  // Pull admins + per-admin pod counts + the active POD list (need each
  // POD's id, codice_amministratore, override, cached_at to reconstruct
  // per-POD paid/due status rolled up to the admin level).
  const fetchActivePods = async (): Promise<Array<{ id: string; codice_amministratore: string | null; pod_override: number | null; cached_at: string }>> => {
    const out: Array<{ id: string; codice_amministratore: string | null; pod_override: number | null; cached_at: string }> = []
    for (let from = 0; ; from += 1000) {
      const { data } = await sb
        .from('apulia_contacts')
        .select('id, codice_amministratore, pod_override, cached_at')
        .eq('is_amministratore', false).eq('is_switch_out', false)
        .neq('sync_status', 'pending_delete')
        .range(from, from + 999)
      if (!data || data.length === 0) break
      out.push(...(data as typeof out))
      if (data.length < 1000) break
    }
    return out
  }
  const fetchPodPayments = async (): Promise<Map<string, { lastPaidAt: string }>> => {
    const map = new Map<string, { lastPaidAt: string }>()
    for (let from = 0; ; from += 1000) {
      const { data } = await sb
        .from('apulia_payments')
        .select('pod_contact_id, paid_at')
        .not('pod_contact_id', 'is', null)
        .order('paid_at', { ascending: false })
        .range(from, from + 999)
      if (!data || data.length === 0) break
      for (const r of data as Array<{ pod_contact_id: string; paid_at: string }>) {
        const existing = map.get(r.pod_contact_id)
        if (!existing) map.set(r.pod_contact_id, { lastPaidAt: r.paid_at })
        else if (r.paid_at > existing.lastPaidAt) existing.lastPaidAt = r.paid_at
      }
      if (data.length < 1000) break
    }
    return map
  }

  const [{ data: admins }, { data: podCounts }, { data: schedule }, { data: latestPayments }, activePods, podPaymentMap] = await Promise.all([
    sb.from('apulia_contacts').select('id, first_name, last_name, email, phone, codice_amministratore, compenso_per_pod, commissione_totale, sync_status, sync_error').eq('is_amministratore', true).neq('sync_status', 'pending_delete'),
    sb.rpc('apulia_admin_pod_counts'),
    sb.rpc('apulia_admin_schedule') as unknown as Promise<{ data: ScheduleRow[] | null }>,
    sb.from('apulia_payments').select('contact_id, paid_at').not('period_idx', 'is', null).order('paid_at', { ascending: false }),
    fetchActivePods(),
    fetchPodPayments(),
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

  // Group active PODs by codice_amministratore for fast per-admin rollup.
  const podsByCode = new Map<string, typeof activePods>()
  for (const p of activePods) {
    const c = p.codice_amministratore
    if (!c) continue
    let arr = podsByCode.get(c)
    if (!arr) { arr = []; podsByCode.set(c, arr) }
    arr.push(p)
  }
  const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000
  const todayMs = Date.now()

  const rows: AdminRow[] = (admins ?? []).map((a) => {
    const code = a.codice_amministratore ?? undefined
    const counts = (code && countMap.get(code)) || { active: 0, switched: 0 }
    const sched = scheduleMap.get(a.id)
    const compenso = Number(a.compenso_per_pod) || 0

    // Roll per-POD payment status up to the admin: how many PODs are
    // currently due, how much owed, when's the next pod's cycle ending.
    let dueCount = 0
    let dueTotal = 0
    let nextDue: string | undefined
    if (code) {
      for (const p of podsByCode.get(code) ?? []) {
        const pay = podPaymentMap.get(p.id)
        const amount = Number(p.pod_override) || compenso
        const isPaid = pay && new Date(pay.lastPaidAt).getTime() + SIX_MONTHS_MS > todayMs
        if (!isPaid) {
          dueCount += 1
          dueTotal += amount
        } else if (pay) {
          const nextMs = new Date(pay.lastPaidAt).getTime() + SIX_MONTHS_MS
          const iso = new Date(nextMs).toISOString()
          if (!nextDue || iso < nextDue) nextDue = iso
        }
      }
    }
    const isDueNow = dueCount > 0
    return {
      contactId: a.id,
      name: [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || '—',
      email: a.email ?? undefined,
      phone: a.phone ?? undefined,
      codiceAmministratore: code,
      compensoPerPod: compenso,
      podsActive: counts.active,
      podsSwitchedOut: counts.switched,
      total: dueTotal, // "Da pagare" — only currently-due PODs.
      paidThisPeriod: !isDueNow && counts.active > 0,
      paidAt: latestPaidMap.get(a.id),
      firstPaymentAt: sched?.first_payment_at ?? undefined,
      nextDueDate: nextDue ?? sched?.next_due_date ?? undefined,
      nextPeriodIdx: sched?.next_period_idx,
      isDueNow,
      overdueCount: dueCount,
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
    // Paginate so admins with >1000 PODs see all of them.
    const fetchAll = async (isSwitchOut: boolean): Promise<CachedContactRow[]> => {
      const out: CachedContactRow[] = []
      for (let from = 0; ; from += 1000) {
        const { data } = await sb
          .from('apulia_contacts').select('*')
          .eq('codice_amministratore', code).eq('is_amministratore', false)
          .eq('is_switch_out', isSwitchOut).neq('sync_status', 'pending_delete')
          .order('pod_pdr').range(from, from + 999)
        if (!data || data.length === 0) break
        out.push(...(data as CachedContactRow[]))
        if (data.length < 1000) break
      }
      return out
    }
    ;[activePods, switchedPods] = await Promise.all([fetchAll(false), fetchAll(true)])
  }

  // Per-POD payment history: latest paid_at + count per pod_contact_id.
  // Paginate to avoid the PostgREST 1000-row cap when an admin has many
  // long-lived PODs with multiple payments each.
  const allPodIds = [...activePods, ...switchedPods].map((p) => p.id)
  const podPaymentMap = new Map<string, { lastPaidAt: string; count: number }>()
  if (allPodIds.length > 0) {
    for (let from = 0; ; from += 1000) {
      const { data: payRows } = await sb
        .from('apulia_payments')
        .select('pod_contact_id, paid_at')
        .in('pod_contact_id', allPodIds)
        .order('paid_at', { ascending: false })
        .range(from, from + 999)
      if (!payRows || payRows.length === 0) break
      for (const r of payRows) {
        const id = (r as { pod_contact_id: string | null }).pod_contact_id
        if (!id) continue
        const paidAt = (r as { paid_at: string }).paid_at
        const cur = podPaymentMap.get(id)
        if (!cur) podPaymentMap.set(id, { lastPaidAt: paidAt, count: 1 })
        else { cur.count += 1; if (paidAt > cur.lastPaidAt) cur.lastPaidAt = paidAt }
      }
      if (payRows.length < 1000) break
    }
  }

  const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000
  const todayMs = Date.now()

  function asPodRow(p: CachedContactRow): PodRow {
    const override = Number(p.pod_override) || 0
    const pay = podPaymentMap.get(p.id)
    const cachedAt = (p as { cached_at?: string }).cached_at
    let nextDueDate: string | undefined
    let paymentStatus: 'paid' | 'due' = 'due'
    if (pay) {
      const nextMs = new Date(pay.lastPaidAt).getTime() + SIX_MONTHS_MS
      nextDueDate = new Date(nextMs).toISOString()
      paymentStatus = nextMs > todayMs ? 'paid' : 'due'
    } else if (cachedAt) {
      // No payment yet — POD is due now (since insertion).
      nextDueDate = cachedAt
      paymentStatus = 'due'
    }
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
      addedAt: cachedAt,
      lastPaidAt: pay?.lastPaidAt,
      nextDueDate,
      paymentStatus,
      paidCount: pay?.count ?? 0,
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

  // Roll per-POD status up to the admin level so the detail page header
  // shows "PODs da pagare = N · € X" anchored to per-POD cycles, not the
  // legacy admin-level apulia_admin_schedule. Switched-out PODs are
  // excluded from commissions.
  const activePodRows = activePods.map(asPodRow)
  const switchedPodRows = switchedPods.map(asPodRow)
  const dueRows = activePodRows.filter((r) => r.paymentStatus === 'due')
  const paidRows = activePodRows.filter((r) => r.paymentStatus === 'paid')
  const dueTotal = dueRows.reduce((s, r) => s + r.amount, 0)
  const earliestNextDue = paidRows
    .map((r) => r.nextDueDate)
    .filter((d): d is string => !!d)
    .sort()[0]

  const adminRow: AdminRow = {
    contactId: a.id,
    name: [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || '—',
    email: a.email ?? undefined,
    phone: a.phone ?? undefined,
    codiceAmministratore: code ?? undefined,
    compensoPerPod: compenso,
    podsActive: activePods.length,
    podsSwitchedOut: switchedPods.length,
    // total now means "soldi attualmente da pagare" (only due PODs).
    total: dueTotal,
    paidThisPeriod: dueRows.length === 0 && paidRows.length > 0,
    paidAt: latestPay?.paid_at as string | undefined,
    firstPaymentAt: sched?.first_payment_at ?? undefined,
    nextDueDate: earliestNextDue ?? sched?.next_due_date ?? undefined,
    nextPeriodIdx: sched?.next_period_idx,
    isDueNow: dueRows.length > 0,
    overdueCount: dueRows.length,
  }

  return { admin: adminRow, activePods: activePodRows, switchedPods: switchedPodRows }
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
