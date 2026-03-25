import Link from 'next/link'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'
import { getContactFilters } from '../settings/_actions'

const BASE_URL = 'https://services.leadconnectorhq.com'

// ─── Working days helpers ────────────────────────────────────────────────────

function countWorkingDays(start: Date, end: Date): number {
  let count = 0
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)
  while (cur <= endDay) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function getWorkingDayStats() {
  const now = new Date()
  const year = now.getFullYear()
  const jan1 = new Date(year, 0, 1)
  const dec31 = new Date(year, 11, 31)
  const passed = countWorkingDays(jan1, now)
  const total = countWorkingDays(jan1, dec31)
  const remaining = total - passed
  return { passed, remaining, total, pct: Math.round((passed / total) * 100) }
}

function getMonthWorkingDayStats() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const passed = countWorkingDays(monthStart, now)
  const total = countWorkingDays(monthStart, monthEnd)
  return { passed, total, pct: total > 0 ? Math.round((passed / total) * 100) : 0 }
}

// ─── GHL helpers ─────────────────────────────────────────────────────────────

interface GhlUser {
  id: string
  name: string
  firstName?: string
  lastName?: string
  email: string
  roles?: { role?: string }
}

async function ghlGet(path: string, token: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
    next: { revalidate: 300 },
  })
  if (!res.ok) return null
  return res.json()
}

async function ghlSearch(
  locationId: string,
  token: string,
  filters: { field: string; operator: string; value: string }[],
  pageLimit = 100,
): Promise<{ total: number; contacts: { id: string; dateAdded?: string; assignedTo?: string; tags?: string[] }[] }> {
  try {
    const res = await fetch(`${BASE_URL}/contacts/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, pageLimit, filters }),
      next: { revalidate: 60 },
    })
    if (!res.ok) return { total: 0, contacts: [] }
    const data = await res.json()
    // GHL search returns total as the full count of matching contacts
    const contacts = data?.contacts ?? []
    const total = data?.total ?? contacts.length
    return { total, contacts }
  } catch {
    return { total: 0, contacts: [] }
  }
}

async function getTagCount(locationId: string, token: string, tag: string): Promise<number> {
  const { total } = await ghlSearch(locationId, token, [{ field: 'tags', operator: 'contains', value: tag }])
  return total
}

async function getContactsCount(locationId: string, token: string): Promise<number> {
  const data = await ghlGet(`/contacts/?locationId=${locationId}&limit=1`, token)
  return data?.total ?? data?.meta?.total ?? 0
}

async function getGhlUsers(locationId: string, token: string): Promise<GhlUser[]> {
  const data = await ghlGet(`/users/?locationId=${locationId}`, token)
  return (data?.users ?? []) as GhlUser[]
}

/** Count contacts with a tag created in a specific month */
async function getTagCountForMonth(
  locationId: string,
  token: string,
  tag: string,
  monthStart: string,
): Promise<number> {
  const startDate = new Date(monthStart + 'T00:00:00.000Z')
  const endDate = new Date(startDate)
  endDate.setMonth(endDate.getMonth() + 1)

  let count = 0
  let page = 1
  while (page <= 5) {
    try {
      const res = await fetch(`${BASE_URL}/contacts/search`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId, pageLimit: 100, page,
          filters: [{ field: 'tags', operator: 'contains', value: tag }],
        }),
        next: { revalidate: 60 },
      })
      if (!res.ok) break
      const data = await res.json()
      const contacts: { id: string; dateAdded?: string }[] = data?.contacts ?? []
      if (contacts.length === 0) break
      for (const c of contacts) {
        if (!c.dateAdded) continue
        const added = new Date(c.dateAdded)
        if (added >= startDate && added < endDate) count++
      }
      if (contacts.length < 100) break
      page++
    } catch { break }
  }
  return count
}

/** Count contacts assigned to a specific user */
async function getContactsForUser(locationId: string, token: string, userId: string): Promise<number> {
  const { total } = await ghlSearch(locationId, token, [{ field: 'assignedTo', operator: 'eq', value: userId }])
  return total
}

/** Count contacts with a tag, optionally filtered to a specific user */
async function getTagCountForUser(locationId: string, token: string, tag: string, userId: string): Promise<number> {
  const { total } = await ghlSearch(locationId, token, [
    { field: 'tags', operator: 'contains', value: tag },
    { field: 'assignedTo', operator: 'eq', value: userId },
  ])
  return total
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CrmDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const locationId = await getActiveLocation(sp).catch(() => null)

  if (!locationId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">Nessuna location connessa. Riconnetti il tuo account GHL.</p>
      </div>
    )
  }

  const supabase = createAdminClient()
  const authClient = await createAuthClient()
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  // Get current user
  const { data: { user: authUser } } = await authClient.auth.getUser()
  const userEmail = authUser?.email?.toLowerCase() ?? ''

  // Check if super_admin
  const { data: profile } = authUser
    ? await supabase.from('profiles').select('role').eq('id', authUser.id).single()
    : { data: null }
  const isSuperAdmin = profile?.role === 'super_admin'

  // Fetch token + settings + gare + contact filters in parallel
  const [token, settingsRes, { data: gareRows }, contactFilters] = await Promise.all([
    getGhlTokenForLocation(locationId).catch(() => null),
    supabase.from('location_settings').select('target_annuale').eq('location_id', locationId).single(),
    supabase.from('gare_mensili').select('categoria, obiettivo, tag').eq('location_id', locationId).eq('month', currentMonth).order('categoria'),
    getContactFilters(locationId),
  ])

  const targetAnnuale: number = settingsRes.data?.target_annuale ?? 1900

  if (!token) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">Token GHL non trovato per questa location.</p>
      </div>
    )
  }

  // Fetch GHL users and determine current user's role
  const ghlUsers = await getGhlUsers(locationId, token)
  const currentGhlUser = ghlUsers.find((u) => u.email.toLowerCase() === userEmail)
  const isGhlAdmin = currentGhlUser?.roles?.role === 'admin'
  const isAdmin = isSuperAdmin || isGhlAdmin

  // Fetch data — non-admin sees only their own assigned contacts
  const currentGhlUserId = currentGhlUser?.id
  const [totalContacts, ...filterTagCounts] = await Promise.all([
    !isAdmin && currentGhlUserId
      ? getContactsForUser(locationId, token, currentGhlUserId)
      : getContactsCount(locationId, token),
    ...contactFilters.map((tag) =>
      !isAdmin && currentGhlUserId
        ? getTagCountForUser(locationId, token, tag, currentGhlUserId)
        : getTagCount(locationId, token, tag)
    ),
  ])

  // Build filter tag count map
  const filterTagCountMap: Record<string, number> = {}
  contactFilters.forEach((tag, i) => { filterTagCountMap[tag] = filterTagCounts[i] ?? 0 })

  // Per-operatore contact counts (admin only) + tag breakdown
  const operatorCounts: { name: string; initials: string; count: number; isAdmin: boolean; tagCounts: Record<string, number> }[] = []
  if (isAdmin && ghlUsers.length > 0) {
    const nonAdminUsers = ghlUsers.filter((u) => u.roles?.role !== 'admin')
    const adminUsers = ghlUsers.filter((u) => u.roles?.role === 'admin')

    // Fetch counts + tag breakdowns for non-admin users
    const nonAdminCounts = await Promise.all(
      nonAdminUsers.map((u) => getContactsForUser(locationId, token, u.id))
    )
    // Tag breakdown per non-admin user
    const nonAdminTagCounts = await Promise.all(
      nonAdminUsers.map(async (u) => {
        const tagMap: Record<string, number> = {}
        const counts = await Promise.all(
          contactFilters.map((tag) => getTagCountForUser(locationId, token, tag, u.id))
        )
        contactFilters.forEach((tag, i) => { tagMap[tag] = counts[i] })
        return tagMap
      })
    )

    for (const u of adminUsers) {
      operatorCounts.push({
        name: u.name,
        initials: u.name?.charAt(0)?.toUpperCase() ?? '?',
        count: totalContacts,
        isAdmin: true,
        tagCounts: filterTagCountMap,
      })
    }
    nonAdminUsers.forEach((u, i) => {
      operatorCounts.push({
        name: u.name,
        initials: u.name?.charAt(0)?.toUpperCase() ?? '?',
        count: nonAdminCounts[i],
        isAdmin: false,
        tagCounts: nonAdminTagCounts[i],
      })
    })
  }

  // Energia section data (admin only)
  let energiaData: {
    totaleLuce: number; totaleGas: number; totaleLuceGas: number;
    expiring30: number; expiring60: number; expiring90: number;
  } | null = null
  if (isAdmin) {
    const [totaleLuce, totaleGas, totaleLuceGas] = await Promise.all([
      getTagCount(locationId, token, 'Luce'),
      getTagCount(locationId, token, 'Gas'),
      getTagCount(locationId, token, 'Energia'),
    ])
    // Count contacts with "Scadenza Contratto Energia" within 30/60/90 days
    // We use tag-based approximation: contacts with 'In Scadenza' tag
    const [expiring30] = await Promise.all([
      getTagCount(locationId, token, 'In Scadenza'),
    ])
    energiaData = {
      totaleLuce, totaleGas, totaleLuceGas,
      expiring30, expiring60: 0, expiring90: 0,
    }
  }

  // Gare data (admin only)
  const wd = getWorkingDayStats()
  const mwd = getMonthWorkingDayStats()
  let gareData: {
    categoria: string; obiettivo: number; attivato: number;
    remaining: number; pctRaggiunta: number; isOnTrack: boolean
  }[] = []

  if (isAdmin && gareRows && gareRows.length > 0) {
    const gareTags = [...new Set(gareRows.map((g: { tag: string }) => g.tag))]
    const gareMonthCounts = await Promise.all(
      gareTags.map((tag) => getTagCountForMonth(locationId, token, tag, currentMonth))
    )
    const gareCountMap: Record<string, number> = {}
    gareTags.forEach((tag, i) => { gareCountMap[tag] = gareMonthCounts[i] })

    gareData = gareRows.map((g: { categoria: string; obiettivo: number; tag: string }) => {
      const attivato = gareCountMap[g.tag] ?? 0
      const pctRaggiunta = g.obiettivo > 0 ? (attivato / g.obiettivo) * 100 : 0
      return {
        categoria: g.categoria,
        obiettivo: g.obiettivo,
        attivato,
        remaining: g.obiettivo - attivato,
        pctRaggiunta,
        isOnTrack: pctRaggiunta >= mwd.pct,
      }
    })
  }

  // Target annuale performance (admin only)
  const contratti = totalContacts // using total contacts as proxy for now
  const pctContratti = targetAnnuale > 0 ? (contratti / targetAnnuale) * 100 : 0
  const pctTempo = wd.pct
  const diff = pctContratti - pctTempo
  const perfStatus: 'green' | 'yellow' | 'red' =
    diff > 2 ? 'green' : diff >= -2 ? 'yellow' : 'red'
  const perfConfig = {
    green:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', label: 'In Target' },
    yellow: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', label: 'Attenzione' },
    red:    { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', label: 'Sotto Target' },
  }[perfStatus]

  const q = `?locationId=${locationId}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {isAdmin ? 'Panoramica operativa' : `I tuoi risultati`} — {now.getFullYear()}
          </p>
        </div>
        <Link
          href={`/designs/apulia-power/contacts/new${q}`}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-black shadow-sm transition-all hover:opacity-90"
          style={{ background: '#00F0FF' }}
        >
          + Nuovo Contatto
        </Link>
      </div>

      {/* ═══ TOP ROW: Overview ═══ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Contatti Totali</p>
          <p className="mt-2 text-3xl font-black text-gray-900">{totalContacts.toLocaleString('it-IT')}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Operatori</p>
          <p className="mt-2 text-3xl font-black text-gray-900">{ghlUsers.length}</p>
        </div>
        <Link href={`/designs/apulia-power/pipeline${q}`} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Pipeline</p>
          <p className="mt-2 text-sm font-medium text-gray-600">Vedi opportunità</p>
        </Link>
        <Link href={`/designs/apulia-power/calendar${q}`} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Calendario</p>
          <p className="mt-2 text-sm font-medium text-gray-600">Vedi appuntamenti</p>
        </Link>
      </div>

      {/* ═══ TARGET ANNUALE (admin only) ═══ */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Target Annuale</p>
              <p className="mt-2 text-4xl font-black" style={{ color: '#2A00CC' }}>
                {targetAnnuale.toLocaleString('it-IT')}
              </p>
              <p className="mt-1 text-xs text-gray-400">contratti obiettivo</p>
              <Link href={`/designs/apulia-power/settings${q}`} className="mt-2 inline-block text-xs font-medium underline" style={{ color: '#2A00CC' }}>
                Modifica
              </Link>
            </div>

            <div className="rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Contratti Chiusi</p>
              <p className="mt-2 text-4xl font-black" style={{ color: '#2A00CC' }}>
                {contratti.toLocaleString('it-IT')}
              </p>
              <p className="mt-1 text-xs text-gray-400">da inizio anno</p>
            </div>

            <div className="rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">% Raggiunta</p>
              <p className="mt-2 text-4xl font-black" style={{ color: '#2A00CC' }}>
                {pctContratti.toFixed(1)}%
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(pctContratti, 100)}%`,
                    background: perfStatus === 'green' ? '#16a34a' : perfStatus === 'yellow' ? '#d97706' : '#dc2626',
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">obiettivo: {pctTempo.toFixed(1)}% atteso</p>
            </div>
          </div>

          {/* Performance banner */}
          <div
            className="rounded-2xl border p-5"
            style={{ background: perfConfig.bg, borderColor: perfConfig.border }}
          >
            <div className="flex items-center justify-between">
              <div>
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
                  style={{ background: perfConfig.border, color: perfConfig.text }}
                >
                  {perfConfig.label}
                </span>
                <p className="mt-2 text-sm font-medium" style={{ color: perfConfig.text }}>
                  {pctContratti.toFixed(1)}% contratti vs {pctTempo}% tempo — differenza {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                </p>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-2xl font-bold" style={{ color: perfConfig.text }}>{wd.passed}</p>
                  <p className="text-xs" style={{ color: perfConfig.text, opacity: 0.7 }}>gg. passati</p>
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: perfConfig.text }}>{wd.remaining}</p>
                  <p className="text-xs" style={{ color: perfConfig.text, opacity: 0.7 }}>gg. rimanenti</p>
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: perfConfig.text }}>{wd.pct}%</p>
                  <p className="text-xs" style={{ color: perfConfig.text, opacity: 0.7 }}>anno trascorso</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ TOTALE PER TAG (from settings filters) ═══ */}
      {contactFilters.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Totale per Categoria</h2>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(contactFilters.length, 4)}, minmax(0, 1fr))` }}>
            {contactFilters.map((tag) => {
              const count = filterTagCountMap[tag] ?? 0
              const pctOfTotal = totalContacts > 0 ? (count / totalContacts) * 100 : 0
              return (
                <Link
                  key={tag}
                  href={`/designs/apulia-power/contacts${q}&filter=${encodeURIComponent(tag)}`}
                  className="group rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-5 shadow-sm hover:shadow-md transition-all"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 capitalize">{tag}</p>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-3xl font-black tabular-nums" style={{ color: '#2A00CC' }}>
                      {count.toLocaleString('it-IT')}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-gray-300">contatti</span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(pctOfTotal, 100)}%`, background: '#2A00CC' }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] tabular-nums text-gray-400">
                    {pctOfTotal.toFixed(1)}% del totale
                  </p>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ═══ PER OPERATORE (admin only) ═══ */}
      {isAdmin && operatorCounts.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Per Operatore</h2>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(operatorCounts.length, 3)}, minmax(0, 1fr))` }}>
            {operatorCounts.map((op) => (
              <div key={op.name} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{op.name}</p>
                    {op.isAdmin && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2A00CC]">Admin</span>
                    )}
                  </div>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: '#2A00CC' }}
                  >
                    {op.initials}
                  </span>
                </div>
                <p className="mt-3 text-3xl font-black text-gray-900">{op.count}</p>
                <p className="mt-1 text-xs text-gray-400">{op.isAdmin ? 'contatti totali' : 'contatti assegnati'}</p>
                {/* Tag breakdown */}
                {contactFilters.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-gray-50 pt-3">
                    {contactFilters.map((tag) => {
                      const tagCount = op.tagCounts[tag] ?? 0
                      return (
                        <div key={tag} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 capitalize">{tag}</span>
                          <span className="font-semibold tabular-nums text-gray-700">{tagCount}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ ENERGIA (admin only) ═══ */}
      {isAdmin && energiaData && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Energia</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Luce</p>
              <p className="mt-2 text-3xl font-black text-amber-600">{energiaData.totaleLuce}</p>
              <p className="mt-1 text-xs text-gray-400">contatti</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Gas</p>
              <p className="mt-2 text-3xl font-black text-amber-600">{energiaData.totaleGas}</p>
              <p className="mt-1 text-xs text-gray-400">contatti</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Totale Energia</p>
              <p className="mt-2 text-3xl font-black text-amber-600">{energiaData.totaleLuceGas}</p>
              <p className="mt-1 text-xs text-gray-400">contatti con tag Energia</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">In Scadenza</p>
              <p className="mt-2 text-3xl font-black text-red-500">{energiaData.expiring30}</p>
              <p className="mt-1 text-xs text-gray-400">contatti con tag &quot;In Scadenza&quot;</p>
            </div>
          </div>
        </section>
      )}

      {/* ═══ STAFF PANORAMICA (admin only) ═══ */}
      {isAdmin && operatorCounts.filter((o) => !o.isAdmin).length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Staff Panoramica</h2>
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Collaboratore</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-widest text-gray-400">Contatti</th>
                  {contactFilters.map((tag) => (
                    <th key={tag} className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-widest text-gray-400 capitalize">{tag}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {operatorCounts.filter((o) => !o.isAdmin).map((op) => (
                  <tr key={op.name} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: '#2A00CC' }}
                        >
                          {op.initials}
                        </span>
                        <span className="font-medium text-gray-800">{op.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-bold tabular-nums text-gray-900">{op.count}</td>
                    {contactFilters.map((tag) => (
                      <td key={tag} className="px-5 py-3 text-right tabular-nums text-gray-600">{op.tagCounts[tag] ?? 0}</td>
                    ))}
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-gray-200 bg-gray-50/80 font-bold">
                  <td className="px-5 py-3 text-gray-700">Totale Staff</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-900">
                    {operatorCounts.filter((o) => !o.isAdmin).reduce((s, o) => s + o.count, 0)}
                  </td>
                  {contactFilters.map((tag) => (
                    <td key={tag} className="px-5 py-3 text-right tabular-nums text-gray-900">
                      {operatorCounts.filter((o) => !o.isAdmin).reduce((s, o) => s + (o.tagCounts[tag] ?? 0), 0)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ═══ GARE MENSILI (admin only) ═══ */}
      {isAdmin && gareData.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">
              Gare — {now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
            </h2>
            <Link href={`/designs/apulia-power/settings${q}`} className="text-xs font-medium underline" style={{ color: '#2A00CC' }}>
              Modifica obiettivi
            </Link>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(gareData.length, 4)}, minmax(0, 1fr))` }}>
            {gareData.map((g) => {
              const pctClamped = Math.min(g.pctRaggiunta, 100)
              const barColor = g.isOnTrack ? '#16a34a' : '#dc2626'
              return (
                <div
                  key={g.categoria}
                  className="rounded-2xl border bg-white p-5 shadow-sm"
                  style={{ borderColor: g.isOnTrack ? '#bbf7d0' : '#fecaca' }}
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 capitalize">{g.categoria}</p>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-3xl font-black tabular-nums text-gray-900">{g.attivato}</span>
                    <span className="text-lg font-semibold tabular-nums text-gray-300">/ {g.obiettivo}</span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pctClamped}%`, background: barColor }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                      style={{
                        background: g.isOnTrack ? '#f0fdf4' : '#fef2f2',
                        color: g.isOnTrack ? '#166534' : '#991b1b',
                      }}
                    >
                      {g.pctRaggiunta.toFixed(1)}%
                    </span>
                    <span className="text-[11px] tabular-nums text-gray-400">
                      {g.remaining > 0 ? `${g.remaining} rimanenti` : 'Completato'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}
