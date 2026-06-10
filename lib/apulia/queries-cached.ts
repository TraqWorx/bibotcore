import { createAdminClient } from '@/lib/supabase-server'
import { currentPeriod } from './fields'
import { computeNextDue, getDefaultPaymentOffset } from './payment-cycle'
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
  /** When this admin row was first cached in Bibot. */
  addedAt?: string
  /** Payment rule: 0 = on Inizio fornitura, 30 = +30 days, null = use default. */
  paymentOffsetDays?: number | null
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
  /** Real switch-out date (Data esecuzione attività). Null for active PODs. */
  switchedOutAt?: string
  /** Normalized store slug from the PDP Note column. */
  store?: string
  /** Editable per-POD payment anchor. Defaults to import date; user can change. */
  firstPaymentAt?: string
  /** Last time this POD was marked paid. */
  lastPaidAt?: string
  /** Next due = firstPaymentAt (or addedAt) + paidCount*6mo. */
  nextDueDate?: string
  /** 'paid' = next due is in the future; 'due' = next due is today or past. */
  paymentStatus?: 'paid' | 'due'
  /** Number of payments recorded for this POD over its lifetime. */
  paidCount?: number
}

export interface ApuliaSnapshot {
  totalAdmins: number
  totalPodsActive: number
  totalPodsSwitchedOut: number
  totalCommissionThisPeriod: number
  /** Count of active PODs whose next payment is due today or in the past. */
  totalPodsDueNow: number
  /** Sum (€) of pod_override-or-admin-compenso across all currently-due PODs. */
  totalDueAmount: number
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
  const [{ count: totalAdmins }, { count: totalPodsActive }, { count: totalPodsSwitchedOut }, { data: admins }, dueStats] = await Promise.all([
    sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', true).neq('sync_status', 'pending_delete'),
    sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('is_switch_out', false).neq('sync_status', 'pending_delete'),
    sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('is_switch_out', true).neq('sync_status', 'pending_delete'),
    sb.from('apulia_contacts').select('commissione_totale').eq('is_amministratore', true).neq('sync_status', 'pending_delete'),
    computePodDueStats(sb),
  ])
  const total = (admins ?? []).reduce((s, a) => s + (Number(a.commissione_totale) || 0), 0)
  return {
    totalAdmins: totalAdmins ?? 0,
    totalPodsActive: totalPodsActive ?? 0,
    totalPodsSwitchedOut: totalPodsSwitchedOut ?? 0,
    totalCommissionThisPeriod: total,
    totalPodsDueNow: dueStats.podsDueNow,
    totalDueAmount: dueStats.dueAmount,
  }
}

async function computePodDueStats(sb: ReturnType<typeof createAdminClient>): Promise<{ podsDueNow: number; dueAmount: number }> {
  // Pull active PODs + admin compensi to roll up "Da pagare oggi" anchored
  // on each POD's first_payment_at (or cached_at fallback). Paginate to
  // dodge the PostgREST 1000-row cap.
  type PodLite = { id: string; codice_amministratore: string | null; pod_override: number | null; cached_at: string; first_payment_at: string | null }
  const pods: PodLite[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('apulia_contacts')
      .select('id, codice_amministratore, pod_override, cached_at, first_payment_at')
      .eq('is_amministratore', false).eq('is_switch_out', false).neq('sync_status', 'pending_delete')
      .range(from, from + 999)
    if (!data || data.length === 0) break
    pods.push(...(data as PodLite[]))
    if (data.length < 1000) break
  }
  const codes = Array.from(new Set(pods.map((p) => p.codice_amministratore).filter((x): x is string => !!x)))
  const compensoByCode = new Map<string, number>()
  const offsetByCode = new Map<string, number | null>()
  if (codes.length > 0) {
    const { data } = await sb.from('apulia_contacts')
      .select('codice_amministratore, compenso_per_pod, payment_offset_days')
      .eq('is_amministratore', true).neq('sync_status', 'pending_delete')
      .in('codice_amministratore', codes)
    for (const r of (data ?? []) as Array<{ codice_amministratore: string; compenso_per_pod: number | null; payment_offset_days: number | null }>) {
      if (r.codice_amministratore) {
        compensoByCode.set(r.codice_amministratore, Number(r.compenso_per_pod) || 0)
        offsetByCode.set(r.codice_amministratore, r.payment_offset_days)
      }
    }
  }
  const defaultOffset = await getDefaultPaymentOffset()
  // Per-POD paid_count via one aggregate RPC (was a full-table pagination loop).
  const paidCountById = new Map<string, number>()
  {
    const { data } = await sb.rpc('apulia_pod_payment_stats')
    for (const r of (data ?? []) as Array<{ pod_contact_id: string; paid_count: number }>) paidCountById.set(r.pod_contact_id, Number(r.paid_count))
  }
  const todayMs = Date.now()
  let podsDueNow = 0
  let dueAmount = 0
  for (const p of pods) {
    const anchorIso = p.first_payment_at ?? p.cached_at
    if (!anchorIso) continue
    const paidCount = paidCountById.get(p.id) ?? 0
    const offset = offsetByCode.get(p.codice_amministratore ?? '') ?? defaultOffset
    const nd = computeNextDue(anchorIso, offset, paidCount)
    if (nd && nd.getTime() <= todayMs) {
      podsDueNow += 1
      const amt = Number(p.pod_override) || compensoByCode.get(p.codice_amministratore ?? '') || 0
      dueAmount += amt
    }
  }
  return { podsDueNow, dueAmount }
}

export async function listAdminsWithStats(): Promise<AdminRow[]> {
  const sb = createAdminClient()

  // Pull admins + per-admin pod counts + the active POD list (need each
  // POD's id, codice_amministratore, override, cached_at, first_payment_at
  // to reconstruct per-POD paid/due status rolled up to the admin level).
  type PodLite = { id: string; codice_amministratore: string | null; pod_override: number | null; cached_at: string; first_payment_at: string | null }
  const fetchActivePods = async (): Promise<PodLite[]> => {
    const out: PodLite[] = []
    for (let from = 0; ; from += 1000) {
      const { data } = await sb
        .from('apulia_contacts')
        .select('id, codice_amministratore, pod_override, cached_at, first_payment_at')
        .eq('is_amministratore', false).eq('is_switch_out', false)
        .neq('sync_status', 'pending_delete')
        .range(from, from + 999)
      if (!data || data.length === 0) break
      out.push(...(data as PodLite[]))
      if (data.length < 1000) break
    }
    return out
  }
  const fetchPodPayments = async (): Promise<Map<string, { lastPaidAt: string; count: number }>> => {
    const map = new Map<string, { lastPaidAt: string; count: number }>()
    const { data } = await sb.rpc('apulia_pod_payment_stats')
    for (const r of (data ?? []) as Array<{ pod_contact_id: string; paid_count: number; last_paid_at: string }>) {
      map.set(r.pod_contact_id, { lastPaidAt: r.last_paid_at, count: Number(r.paid_count) })
    }
    return map
  }

  const [{ data: admins }, { data: podCounts }, { data: latestPayments }, activePods, podPaymentMap] = await Promise.all([
    sb.from('apulia_contacts').select('id, first_name, last_name, email, phone, codice_amministratore, compenso_per_pod, commissione_totale, sync_status, sync_error, cached_at, payment_offset_days').eq('is_amministratore', true).neq('sync_status', 'pending_delete'),
    sb.rpc('apulia_admin_pod_counts'),
    sb.from('apulia_payments').select('contact_id, paid_at').order('paid_at', { ascending: false }),
    fetchActivePods(),
    fetchPodPayments(),
  ])

  const countMap = new Map<string, { active: number; switched: number }>()
  for (const r of (podCounts ?? []) as Array<{ codice_amministratore: string; active: number; switched: number }>) {
    if (r.codice_amministratore) countMap.set(r.codice_amministratore, { active: Number(r.active), switched: Number(r.switched) })
  }
  const latestPaidMap = new Map<string, string>()
  for (const p of latestPayments ?? []) {
    if (!latestPaidMap.has(p.contact_id)) latestPaidMap.set(p.contact_id, p.paid_at as string)
  }
  const defaultOffset = await getDefaultPaymentOffset()

  // Group active PODs by codice_amministratore for fast per-admin rollup.
  const podsByCode = new Map<string, typeof activePods>()
  for (const p of activePods) {
    const c = p.codice_amministratore
    if (!c) continue
    let arr = podsByCode.get(c)
    if (!arr) { arr = []; podsByCode.set(c, arr) }
    arr.push(p)
  }
  const todayMs = Date.now()

  const rows: AdminRow[] = (admins ?? []).map((a) => {
    const code = a.codice_amministratore ?? undefined
    const counts = (code && countMap.get(code)) || { active: 0, switched: 0 }
    const compenso = Number(a.compenso_per_pod) || 0

    // Roll per-POD payment status up to the admin: same rule as the
    // detail page — nextDueDate = addedAt + paidCount * 6mo (calendar
    // months, anchored to addedAt forever, not paid_at).
    const offset = (a as { payment_offset_days?: number | null }).payment_offset_days ?? defaultOffset
    let dueCount = 0
    let dueTotal = 0
    let nextDue: string | undefined
    if (code) {
      for (const p of podsByCode.get(code) ?? []) {
        const pay = podPaymentMap.get(p.id)
        const paidCount = pay?.count ?? 0
        const amount = Number(p.pod_override) || compenso
        const anchorIso = p.first_payment_at ?? p.cached_at
        const nd = computeNextDue(anchorIso, offset, paidCount)
        if (!nd) continue
        // Earliest unpaid due date across the admin's PODs — past (overdue)
        // or future. The UI colours it red when isDueNow.
        const iso = nd.toISOString()
        if (!nextDue || iso < nextDue) nextDue = iso
        if (nd.getTime() <= todayMs) {
          dueCount += 1
          dueTotal += amount
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
      firstPaymentAt: undefined,
      nextDueDate: nextDue ?? undefined,
      nextPeriodIdx: undefined,
      isDueNow,
      overdueCount: dueCount,
      syncStatus: (a as { sync_status?: string }).sync_status ?? undefined,
      syncError: (a as { sync_error?: string | null }).sync_error ?? null,
      addedAt: (a as { cached_at?: string }).cached_at,
      paymentOffsetDays: (a as { payment_offset_days?: number | null }).payment_offset_days ?? null,
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
  const defaultOffset = await getDefaultPaymentOffset()
  const offset = (a as { payment_offset_days?: number | null }).payment_offset_days ?? defaultOffset

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

  // Per-POD payment history: count + most recent paid_at, keyed by
  // pod_contact_id. Paginate to avoid the PostgREST 1000-row cap when
  // an admin has many long-lived PODs with multiple payments each.
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

  const todayMs = Date.now()

  function asPodRow(p: CachedContactRow): PodRow {
    const override = Number(p.pod_override) || 0
    const pay = podPaymentMap.get(p.id)
    const paidCount = pay?.count ?? 0
    const cachedAt = (p as { cached_at?: string }).cached_at
    const firstPaymentAt = (p as { first_payment_at?: string | null }).first_payment_at ?? null
    // Per-POD cycle anchored on first_payment_at (editable) when set,
    // otherwise on cached_at (the import date). nextDueDate =
    // anchor + paidCount * 6 months. paidCount=0 means the POD is "Da
    // Pagare" the moment the anchor lands; paidCount=1 → anchor+6mo, …
    const anchorIso = firstPaymentAt ?? cachedAt
    let nextDueDate: string | undefined
    let paymentStatus: 'paid' | 'due' = 'due'
    const nd = computeNextDue(anchorIso, offset, paidCount)
    if (nd) {
      nextDueDate = nd.toISOString()
      paymentStatus = nd.getTime() <= todayMs ? 'due' : 'paid'
    } else {
      paymentStatus = paidCount === 0 ? 'due' : 'paid'
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
      switchedOutAt: (p as { switched_out_at?: string | null }).switched_out_at ?? undefined,
      firstPaymentAt: firstPaymentAt ?? undefined,
      lastPaidAt: pay?.lastPaidAt,
      nextDueDate,
      paymentStatus,
      paidCount: pay?.count ?? 0,
    }
  }

  // Last payment date across both admin-level and per-POD rows.
  const { data: latestPay } = await sb
    .from('apulia_payments')
    .select('paid_at')
    .eq('contact_id', adminContactId)
    .order('paid_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Roll per-POD status up to the admin level so the detail page header
  // shows "PODs da pagare = N · € X". Switched-out PODs are excluded
  // from commissions.
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
    firstPaymentAt: undefined,
    nextDueDate: earliestNextDue ?? undefined,
    nextPeriodIdx: undefined,
    isDueNow: dueRows.length > 0,
    overdueCount: dueRows.length,
    paymentOffsetDays: (a as { payment_offset_days?: number | null }).payment_offset_days ?? null,
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

  const podRows: PodRow[] = ((rows ?? []) as Array<CachedContactRow & { sync_error?: string | null; cached_at?: string; switched_out_at?: string | null; store?: string | null }>).map((r) => ({
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
    addedAt: r.cached_at,
    switchedOutAt: r.switched_out_at ?? undefined,
    store: r.store ?? undefined,
  }))

  return { total: count ?? 0, rows: podRows, comuni, amministratori }
}
