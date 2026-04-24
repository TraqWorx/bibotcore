import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import OpenCrmButton from './locations/_components/OpenCrmButton'
import { ad } from '@/lib/admin/ui'

export const dynamic = 'force-dynamic'

const GHL_BASE = 'https://services.leadconnectorhq.com'

async function ghlAgencyGet(path: string) {
  const token = process.env.GHL_AGENCY_TOKEN
  if (!token) return null
  const res = await fetch(`${GHL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

export default async function AgencyPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>
}) {
  const { as: previewAs } = await searchParams
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, location_id, agency_id')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
  const companyId = process.env.GHL_COMPANY_ID

  // All connected location IDs from Supabase
  const { data: connections } = await supabase
    .from('ghl_connections')
    .select('location_id')
  const connectedIds = new Set((connections ?? []).map((c) => c.location_id))

  let locationIds: string[] = []
  let previewUserEmail: string | null = null

  // Resolve locations for a user via profile_locations + GHL fallback
  async function resolveLocationsForUser(userId: string, email: string): Promise<string[]> {
    // 1. Check profile_locations junction table
    const { data: profileLocs } = await supabase
      .from('profile_locations')
      .select('location_id')
      .eq('user_id', userId)
    const fromDb = (profileLocs ?? []).map((r) => r.location_id)
    if (fromDb.length > 0) return fromDb

    // 2. Fallback: search GHL by email
    const encoded = encodeURIComponent(email)
    const data = await ghlAgencyGet(
      `/users/search?companyId=${companyId}&email=${encoded}&limit=100`
    )
    const ghlUsers: { locationId?: string; locationIds?: string[] }[] = data?.users ?? []
    const fromGhl = [
      ...new Set(ghlUsers.flatMap((u) => u.locationIds ?? (u.locationId ? [u.locationId] : []))),
    ]
    if (fromGhl.length > 0) return fromGhl

    // 3. Fallback: profiles.location_id
    const { data: prof } = await supabase
      .from('profiles')
      .select('location_id')
      .eq('id', userId)
      .single()
    return prof?.location_id ? [prof.location_id] : []
  }

  // Admin or super_admin previewing as a specific user
  if ((isAdmin) && previewAs) {
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('email, agency_id')
      .eq('id', previewAs)
      .single()

    // Agency owners can only preview users in their own agency
    // Admins can preview users in their own agency; super_admin can preview anyone
    const canPreview = profile?.role === 'super_admin' || (isAdmin && targetProfile?.agency_id === profile?.agency_id)
    if (targetProfile?.email && canPreview) {
      previewUserEmail = targetProfile.email
      locationIds = await resolveLocationsForUser(previewAs, targetProfile.email)
    }
  } else {
    locationIds = await resolveLocationsForUser(user.id, user.email ?? '')
  }

  console.log('[agency] resolved locationIds:', locationIds.length, locationIds)

  // Fetch names + install info + packages in parallel
  const [{ data: locationRows }, { data: installs }, ghlLocationsData, { data: ghlPlans }] = await Promise.all([
    locationIds.length
      ? supabase.from('locations').select('location_id, name, ghl_plan_id, ghl_date_added, created_at').in('location_id', locationIds)
      : Promise.resolve({ data: [] }),
    locationIds.length
      ? supabase.from('installs').select('location_id, design_slug, configured, installed_at').in('location_id', locationIds)
      : Promise.resolve({ data: [] }),
    ghlAgencyGet(`/locations/search?limit=100${companyId ? `&companyId=${companyId}` : ''}`),
    supabase.from('ghl_plans').select('ghl_plan_id, name, price_monthly'),
  ])

  const nameById: Record<string, string> = {}
  for (const l of (ghlLocationsData?.locations ?? []) as { id: string; name: string }[]) {
    if (l.id && l.name) nameById[l.id] = l.name
  }
  for (const r of locationRows ?? []) if (r.name) nameById[r.location_id] = r.name

  const planByPlanId: Record<string, { name: string; price: number | null }> = {}
  for (const p of ghlPlans ?? []) {
    planByPlanId[p.ghl_plan_id] = { name: p.name, price: p.price_monthly != null ? Number(p.price_monthly) : null }
  }

  const planByLocation: Record<string, { planId: string; planName: string; price: number | null; createdAt: string | null; dateAdded: string | null }> = {}
  for (const r of locationRows ?? []) {
    const row = r as { location_id: string; ghl_plan_id?: string | null; created_at?: string | null; ghl_date_added?: string | null }
    const planId = row.ghl_plan_id ?? null
    const planInfo = planId ? planByPlanId[planId] ?? null : null
    planByLocation[r.location_id] = {
      planId: planId ?? '',
      planName: planInfo?.name ?? '',
      price: planInfo?.price ?? null,
      createdAt: row.created_at ?? null,
      dateAdded: row.ghl_date_added ?? null,
    }
  }

  const installById: Record<string, { designSlug: string | null; configured: boolean; installedAt: string }> = {}
  for (const i of installs ?? []) {
    installById[i.location_id] = {
      designSlug: i.design_slug ?? null,
      configured: i.configured ?? false,
      installedAt: i.installed_at
        ? new Date(i.installed_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—',
    }
  }

  const rows = locationIds.map((id) => {
    const plan = planByLocation[id] ?? null
    return {
      locationId: id,
      name: nameById[id] ?? id,
      designSlug: installById[id]?.designSlug ?? null,
      configured: installById[id]?.configured ?? false,
      installedAt: installById[id]?.installedAt ?? '—',
      planId: plan?.planId || null,
      planName: plan?.planName || null,
      planPrice: plan?.price ?? null,
      createdAt: plan?.createdAt ?? null,
      dateAdded: plan?.dateAdded ?? null,
    }
  })

  // Compute stats
  const hasDesigns = rows.some((r) => r.designSlug)
  const designCounts: Record<string, number> = {}
  for (const row of rows) {
    const key = row.designSlug ?? '—'
    designCounts[key] = (designCounts[key] ?? 0) + 1
  }

  function monthsSince(iso: string): number {
    const start = new Date(iso)
    const now = new Date()
    const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
    return Math.max(1, months) // at least 1 if plan is active
  }

  let monthlyRevenue: number | null = null
  let billedCount = 0
  let totalRevenue = 0
  for (const row of rows) {
    if (row.planPrice != null) {
      monthlyRevenue = (monthlyRevenue ?? 0) + row.planPrice
      billedCount++
      const months = row.dateAdded ? monthsSince(row.dateAdded) : 0
      totalRevenue += row.planPrice * months
    }
  }

  return (
    <div className="space-y-6">
      {/* Preview banner */}
      {previewUserEmail && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/25 bg-brand/10 px-5 py-3">
          <p className="text-sm font-medium text-gray-900">
            Visualizzando come <span className="font-semibold">{previewUserEmail}</span>
          </p>
          <Link href="/admin/users" className="text-xs font-bold text-brand underline-offset-4 hover:underline">
            Torna agli Utenti
          </Link>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className={ad.pageTitle}>Le Mie Location</h1>
        <p className={ad.pageSubtitle}>Seleziona una location per aprire il CRM.</p>
      </div>

      {/* Stats */}
      <div className={`grid gap-4 ${hasDesigns ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {/* Total locations */}
        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Location Totali</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{rows.length}</p>
        </div>

        {/* Per design — only shown if agency has designs */}
        {hasDesigns && (
          <div className={ad.panel}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Per Design</p>
            <div className="space-y-2">
              {Object.entries(designCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([slug, count]) => (
                  <div key={slug} className="flex items-center justify-between">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${
                      slug === '—'
                        ? 'border-gray-200 bg-gray-50 text-gray-500'
                        : 'border-brand/20 bg-brand/10 text-brand'
                    }`}>
                      {slug}
                    </span>
                    <span className="text-sm font-semibold text-gray-700">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Monthly revenue */}
        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Spese Mensili</p>
          {monthlyRevenue != null ? (
            <>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                €{monthlyRevenue.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                da {billedCount} location fatturate
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-2xl font-bold text-gray-300">—</p>
              <p className="mt-1 text-xs text-gray-400">Nessun dato disponibile</p>
            </>
          )}
        </div>

        {/* Total revenue since added */}
        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Totale Pagato</p>
          {totalRevenue > 0 ? (
            <>
              <p className="mt-2 text-3xl font-bold text-emerald-600">
                €{totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="mt-1 text-xs text-gray-400">dalla data di attivazione</p>
            </>
          ) : (
            <>
              <p className="mt-2 text-2xl font-bold text-gray-300">—</p>
              <p className="mt-1 text-xs text-gray-400">Nessuno storico pagamenti</p>
            </>
          )}
        </div>
      </div>

      {/* Location list */}
      {rows.length === 0 ? (
        <div className={`${ad.panel} p-10 text-center`}>
          <p className="text-sm font-medium text-gray-900">Nessuna location trovata</p>
          <p className="mt-1 text-sm text-gray-500">
            Il tuo account non è ancora associato a nessuna location.
          </p>
        </div>
      ) : (
        <div className={ad.tableShell}>
          <table className="w-full text-sm">
            <thead>
              <tr className={ad.tableHeadRow}>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Location</th>
                {hasDesigns && <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Design</th>}
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Piano</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Prezzo</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Mesi</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Totale Pagato</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => (
                <tr key={row.locationId} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-4 font-medium text-gray-900">{row.name}</td>
                  {hasDesigns && (
                    <td className="px-5 py-4 text-gray-600">
                      {row.designSlug
                        ? <span className="rounded-full border border-brand/20 bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">{row.designSlug}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  <td className="px-5 py-4 text-xs font-medium text-gray-700">
                    {row.planName ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-4 text-xs font-medium text-gray-700">
                    {row.planPrice != null
                      ? `€${row.planPrice.toLocaleString('it-IT')}/mo`
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-4 text-right text-xs tabular-nums text-gray-500">
                    {row.dateAdded ? `${monthsSince(row.dateAdded)} mo` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-4 text-right text-xs font-bold tabular-nums text-emerald-600">
                    {row.planPrice != null && row.dateAdded
                      ? `€${(row.planPrice * monthsSince(row.dateAdded)).toLocaleString('it-IT')}`
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {row.designSlug && (
                      <OpenCrmButton locationId={row.locationId} designSlug={row.designSlug} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
