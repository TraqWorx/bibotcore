import { createAdminClient } from '@/lib/supabase-server'
import LogoutButton from './_components/LogoutButton'
import LocationChart from './_components/LocationChart'

const GHL_BASE = 'https://services.leadconnectorhq.com'

interface GhlLocation {
  id: string
  name: string
  dateAdded: string | null
}

async function fetchGhlLocations(): Promise<GhlLocation[]> {
  const token = process.env.GHL_AGENCY_TOKEN
  const companyId = process.env.GHL_COMPANY_ID
  if (!token) return []
  try {
    const params = new URLSearchParams({ limit: '100' })
    if (companyId) params.set('companyId', companyId)
    const res = await fetch(`${GHL_BASE}/locations/search?${params}`, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.locations ?? []).map((l: {
      id: string; name: string
      dateAdded?: string; date_added?: string; created?: string; createdAt?: string; created_at?: string
    }) => ({
      id: l.id,
      name: l.name ?? l.id,
      dateAdded: l.dateAdded ?? l.date_added ?? l.created ?? l.createdAt ?? l.created_at ?? null,
    }))
  } catch { return [] }
}

export default async function AdminPage() {
  const supabase = createAdminClient()

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const todayStr = now.toISOString().split('T')[0]

  const [
    ghlLocations,
    { count: totalUsers },
    { count: totalInstalls },
    { count: newInstallsToday },
    { data: allInstallsRaw },
    { data: recentInstallsRaw },
    { data: locationsData },
    { data: designStatsRaw },
    { data: locationPlanRows },
    { data: ghlPlans },
  ] = await Promise.all([
    fetchGhlLocations(),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).neq('role', 'super_admin'),
    supabase.from('installs').select('*', { count: 'exact', head: true }),
    supabase.from('installs').select('*', { count: 'exact', head: true }).gte('installed_at', todayStr),
    supabase.from('installs').select('installed_at').order('installed_at'),
    supabase.from('installs').select('id, location_id, design_slug, installed_at, user_id').order('installed_at', { ascending: false }).limit(7),
    supabase.from('locations').select('location_id, name'),
    supabase.from('installs').select('design_slug, location_id'),
    supabase.from('locations').select('location_id, ghl_plan_id'),
    supabase.from('ghl_plans').select('ghl_plan_id, name, price_monthly'),
  ])

  const totalLocationsCount = ghlLocations.filter((l) => locationPlanMap[l.id]).length

  // Build chart dates from GHL location creation timestamps
  // Fall back to install dates if GHL fetch failed
  const todayISO = now.toISOString()
  let allDates: string[]
  if (ghlLocations.length > 0) {
    allDates = ghlLocations.map((l) => l.dateAdded ?? todayISO).sort()
  } else {
    allDates = (allInstallsRaw ?? []).map((r) => r.installed_at).filter(Boolean) as string[]
  }

  // New locations this week (from GHL timestamps)
  const sevenDaysAgoISO = sevenDaysAgo.toISOString()
  const newLocationsThisWeek = ghlLocations.filter((l) => l.dateAdded && l.dateAdded >= sevenDaysAgoISO && locationPlanMap[l.id]).length

  // Design distribution
  const designCounts: Record<string, number> = {}
  for (const r of designStatsRaw ?? []) {
    const slug = r.design_slug ?? '—'
    designCounts[slug] = (designCounts[slug] ?? 0) + 1
  }
  const designRows = Object.entries(designCounts)
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const planInfoById: Record<string, { name: string; price: number | null }> = {}
  for (const p of ghlPlans ?? []) {
    planInfoById[p.ghl_plan_id] = { name: p.name, price: p.price_monthly != null ? Number(p.price_monthly) : null }
  }

  // Build location → planId map
  const locationPlanMap: Record<string, string> = {}
  for (const c of locationPlanRows ?? []) {
    const row = c as { location_id: string; ghl_plan_id?: string | null }
    if (row.ghl_plan_id) locationPlanMap[row.location_id] = row.ghl_plan_id
  }

  // Count locations per plan
  const planCounts: Record<string, { name: string; price: number | null; count: number }> = {}
  let mrr: number | null = null
  let mrrCount = 0
  for (const [, planId] of Object.entries(locationPlanMap)) {
    const info = planInfoById[planId]
    if (!planCounts[planId]) {
      const shortId = planId.slice(-6)
      planCounts[planId] = { name: info?.name ?? `Unknown (…${shortId})`, price: info?.price ?? null, count: 0 }
    }
    planCounts[planId].count++
    if (info?.price != null) {
      mrr = (mrr ?? 0) + info.price
      mrrCount++
    }
  }
  const planRows = Object.values(planCounts).sort((a, b) => b.count - a.count)

  // Revenue per design
  const designRevenue: Record<string, { count: number; mrr: number }> = {}
  for (const r of designStatsRaw ?? []) {
    const slug = r.design_slug ?? '—'
    if (!designRevenue[slug]) designRevenue[slug] = { count: 0, mrr: 0 }
    designRevenue[slug].count++
    const planId = locationPlanMap[r.location_id]
    if (planId) {
      const price = planInfoById[planId]?.price
      if (price != null) designRevenue[slug].mrr += price
    }
  }
  const designRevenueRows = Object.entries(designRevenue)
    .map(([slug, data]) => ({ slug, ...data }))
    .sort((a, b) => b.mrr - a.mrr || b.count - a.count)

  // Location name lookup — supplement with GHL data
  const locationNameById: Record<string, string> = {}
  for (const l of locationsData ?? []) locationNameById[l.location_id] = l.name
  for (const l of ghlLocations) if (l.name) locationNameById[l.id] = l.name

  // Also backfill locations table from GHL data (for future name lookups)
  if (ghlLocations.length > 0) {
    await supabase.from('locations').upsert(
      ghlLocations.map((l) => ({ location_id: l.id, name: l.name })),
      { onConflict: 'location_id' }
    )
  }

  // User emails for recent installs
  const recentInstalls = recentInstallsRaw ?? []
  const userIds = [...new Set(recentInstalls.map((r) => r.user_id).filter(Boolean))]
  let emailById: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', userIds)
    for (const p of profiles ?? []) emailById[p.id] = p.email ?? '—'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <LogoutButton />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-4">
        {/* Locations */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Locations</p>
              <p className="mt-2 text-4xl font-bold tracking-tight" style={{ color: '#2A00CC' }}>
                {totalLocationsCount.toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">with paid plan</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ background: 'rgba(42,0,204,0.07)', color: '#2A00CC' }}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          {newLocationsThisWeek > 0 && (
            <div className="mt-3 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                ↑ +{newLocationsThisWeek}
              </span>
              <span className="text-[11px] text-gray-400">this week</span>
            </div>
          )}
        </div>

        {/* Users */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Users</p>
              <p className="mt-2 text-4xl font-bold tracking-tight" style={{ color: '#7c3aed' }}>
                {(totalUsers ?? 0).toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">registered</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ background: 'rgba(124,58,237,0.07)', color: '#7c3aed' }}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 17a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Installs */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Installs</p>
              <p className="mt-2 text-4xl font-bold tracking-tight" style={{ color: '#059669' }}>
                {(totalInstalls ?? 0).toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">total</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ background: 'rgba(5,150,105,0.07)', color: '#059669' }}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          {(newInstallsToday ?? 0) > 0 && (
            <div className="mt-3 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                ↑ +{newInstallsToday}
              </span>
              <span className="text-[11px] text-gray-400">today</span>
            </div>
          )}
        </div>

        {/* Designs */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Designs</p>
              <p className="mt-2 text-4xl font-bold tracking-tight" style={{ color: '#d97706' }}>
                {designRows.length}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">active</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ background: 'rgba(217,119,6,0.07)', color: '#d97706' }}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M3.75 3a.75.75 0 00-.75.75v.5c0 .414.336.75.75.75H4c6.075 0 11 4.925 11 11v.25c0 .414.336.75.75.75h.5a.75.75 0 00.75-.75V16C17 8.82 11.18 3 4 3h-.25zM3 8.75A.75.75 0 013.75 8H4a8 8 0 018 8v.25a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75V16a6 6 0 00-6-6h-.25A.75.75 0 013 9.25v-.5zM7 15a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* MRR */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">MRR</p>
              {mrr != null ? (
                <>
                  <p className="mt-2 text-4xl font-bold tracking-tight" style={{ color: '#0e9f6e' }}>
                    €{mrr.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">{mrrCount} billed</p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-4xl font-bold tracking-tight text-gray-200">—</p>
                  <p className="mt-0.5 text-xs text-gray-400">no pricing set</p>
                </>
              )}
            </div>
            <div className="rounded-xl p-2.5" style={{ background: 'rgba(14,159,110,0.07)', color: '#0e9f6e' }}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M10.75 10.818v2.614A3.13 3.13 0 0011.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 00-1.138-.432zM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 00-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.909 0 .184.058.39.33.615z" />
                <path fillRule="evenodd" d="M9.99 2a8 8 0 100 16 8 8 0 000-16zM10 5.25a.75.75 0 01.75.75v.316a3.78 3.78 0 011.653.713c.426.33.744.74.925 1.2a.75.75 0 01-1.395.55 1.35 1.35 0 00-.428-.563 2.29 2.29 0 00-.755-.38V9.5c.54.115 1.018.3 1.394.568.377.268.711.68.711 1.307 0 .587-.278 1.04-.705 1.36-.37.277-.843.45-1.4.516V14a.75.75 0 01-1.5 0v-.316a3.78 3.78 0 01-1.653-.713 2.85 2.85 0 01-.925-1.2.75.75 0 011.395-.55c.085.214.22.407.428.563.207.155.487.278.755.38V9.688a6.26 6.26 0 01-1.394-.568C7.278 8.852 6.944 8.44 6.944 7.813c0-.587.278-1.04.705-1.36.37-.277.843-.45 1.4-.516V6a.75.75 0 01.75-.75z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Locations Growth</h2>
            <p className="text-xs text-gray-400 mt-0.5">Total locations over time</p>
          </div>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
            {totalLocationsCount} total
          </span>
        </div>
        <LocationChart allDates={allDates} />
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-5 gap-4">
        {/* Recent installs */}
        <div className="col-span-3 rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-50 px-5 py-4">
            <h2 className="text-sm font-bold text-gray-800">Recent Installs</h2>
          </div>
          {recentInstalls.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">No installs yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Location</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">User</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Design</th>
                  <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentInstalls.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800 max-w-[140px] truncate">
                      {locationNameById[r.location_id] ?? r.location_id}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 max-w-[140px] truncate">
                      {r.user_id ? (emailById[r.user_id] ?? '—') : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {r.design_slug ? (
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                          {r.design_slug}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-gray-400 whitespace-nowrap">
                      {r.installed_at
                        ? new Date(r.installed_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right column: Design + Plan distribution */}
        <div className="col-span-2 flex flex-col gap-4">
          {/* Design distribution */}
          <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-50 px-5 py-4">
              <h2 className="text-sm font-bold text-gray-800">Design Distribution</h2>
            </div>
            {designRows.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">No designs installed.</p>
            ) : (
              <div className="p-5 space-y-4">
                {designRows.map((row) => {
                  const pct = totalInstalls ? Math.round((row.count / totalInstalls) * 100) : 0
                  return (
                    <div key={row.slug}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{row.slug}</span>
                        <span className="text-xs font-semibold text-gray-900">{row.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #2A00CC, #7c3aed)' }}
                        />
                      </div>
                      <p className="mt-0.5 text-right text-[10px] text-gray-400">{pct}%</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Revenue by Design */}
          <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-50 px-5 py-4">
              <h2 className="text-sm font-bold text-gray-800">Locations by Design</h2>
            </div>
            {designRevenueRows.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">No design data.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Design</th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">Locations</th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {designRevenueRows.map((row) => (
                    <tr key={row.slug} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.slug === '—' ? 'bg-gray-100 text-gray-400' : 'bg-violet-50 text-violet-700'}`}>
                          {row.slug}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-xs font-semibold text-gray-700">{row.count}</td>
                      <td className="px-5 py-3 text-right text-xs font-semibold" style={{ color: '#0e9f6e' }}>
                        {row.mrr > 0
                          ? `€${row.mrr.toLocaleString('it-IT')}`
                          : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Plan distribution */}
          <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-50 px-5 py-4">
              <h2 className="text-sm font-bold text-gray-800">Locations by Plan</h2>
            </div>
            {planRows.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">No plan data. Click "Sync Plan Prices" on the Locations page.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Plan</th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">Locations</th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {planRows.map((row) => (
                    <tr key={row.name} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-gray-800">{row.name}</td>
                      <td className="px-5 py-3 text-right text-xs font-semibold text-gray-700">{row.count}</td>
                      <td className="px-5 py-3 text-right text-xs font-semibold" style={{ color: '#0e9f6e' }}>
                        {row.price != null
                          ? `€${(row.price * row.count).toLocaleString('it-IT')}`
                          : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
