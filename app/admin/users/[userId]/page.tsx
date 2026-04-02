import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-server'
import { ad } from '@/lib/admin/ui'

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const supabase = createAdminClient()

  // Load profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, location_id, created_at')
    .eq('id', userId)
    .single()

  if (!profile) notFound()

  // Load locations from junction table + legacy fallback
  const [{ data: profileLocs }, { data: installs }] = await Promise.all([
    supabase.from('profile_locations').select('location_id').eq('user_id', userId),
    supabase
      .from('installs')
      .select('id, location_id, design_slug, status, installed_at')
      .eq('user_id', userId)
      .order('installed_at', { ascending: false }),
  ])

  const allInstalls = installs ?? []
  const activeInstalls = allInstalls.filter((i) => i.status === 'active')

  // Merge location IDs from junction table + legacy profile.location_id + installs
  const locationIds = [...new Set([
    ...(profileLocs ?? []).map((r) => r.location_id),
    ...(profile.location_id ? [profile.location_id] : []),
    ...allInstalls.map((i) => i.location_id).filter(Boolean),
  ])] as string[]

  // Fetch location details (name + plan) and plan prices
  const [{ data: locationRows }, { data: ghlPlans }] = await Promise.all([
    locationIds.length > 0
      ? supabase.from('locations').select('location_id, name, ghl_plan_id').in('location_id', locationIds)
      : Promise.resolve({ data: [] }),
    supabase.from('ghl_plans').select('ghl_plan_id, name, price_monthly'),
  ])

  const nameByLocationId: Record<string, string> = {}
  const planByLocationId: Record<string, { planName: string; price: number | null }> = {}
  const planPriceById: Record<string, { name: string; price: number | null }> = {}
  for (const p of ghlPlans ?? []) {
    planPriceById[p.ghl_plan_id] = { name: p.name, price: p.price_monthly != null ? Number(p.price_monthly) : null }
  }
  for (const loc of locationRows ?? []) {
    nameByLocationId[loc.location_id] = loc.name
    if (loc.ghl_plan_id && planPriceById[loc.ghl_plan_id]) {
      planByLocationId[loc.location_id] = {
        planName: planPriceById[loc.ghl_plan_id].name,
        price: planPriceById[loc.ghl_plan_id].price,
      }
    }
  }

  // Compute MRR across all user locations
  let userMrr = 0
  let billedLocations = 0
  for (const id of locationIds) {
    const plan = planByLocationId[id]
    if (plan?.price != null) {
      userMrr += plan.price
      billedLocations++
    }
  }

  const statCards = [
    { label: 'Locations', value: String(locationIds.length) },
    { label: 'Monthly Spend', value: userMrr > 0 ? `€${userMrr.toLocaleString('it-IT')}` : '—', sub: billedLocations > 0 ? `${billedLocations} billed` : undefined },
    { label: 'Installs', value: String(allInstalls.length), sub: activeInstalls.length > 0 ? `${activeInstalls.length} active` : undefined },
  ]

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/users"
          className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Back to Users
        </Link>
      </div>

      {/* User header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className={ad.pageTitle}>{profile.email ?? '—'}</h1>
          <div className="mt-1 flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${
                profile.role === 'super_admin'
                  ? 'border-purple-200 bg-purple-50/80 text-purple-800'
                  : 'border-gray-200 bg-gray-50 text-gray-600'
              }`}
            >
              {profile.role ?? 'user'}
            </span>
            <span className="text-xs text-gray-400">
              Joined {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
            </span>
            <span className="font-mono text-xs text-gray-400">{profile.id}</span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className={ad.panel}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{card.value}</p>
            {card.sub && <p className="mt-0.5 text-xs text-gray-400">{card.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Locations */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Locations ({locationIds.length})
          </h2>
          <div className={ad.tableShell}>
            {locationIds.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">No locations connected.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className={ad.tableHeadRow}>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Plan</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {locationIds.map((loc) => {
                    const plan = planByLocationId[loc]
                    return (
                      <tr key={loc} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                        <td className="px-4 py-3">
                          <Link href={`/admin/locations/${loc}`} className="font-semibold text-brand hover:underline transition-colors">
                            {nameByLocationId[loc] ?? loc}
                          </Link>
                          <div className="mt-0.5 font-mono text-[10px] text-gray-400">{loc}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {plan?.planName ?? <span className="text-gray-300">—</span>}
                        </td>
                        <td className={`px-4 py-3 text-right text-xs font-bold tabular-nums ${plan?.price != null ? 'text-emerald-700' : 'text-gray-400'}`}>
                          {plan?.price != null
                            ? `€${plan.price.toLocaleString('it-IT')}/mo`
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* All installs */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Installs ({allInstalls.length})
          </h2>
          <div className={ad.tableShell}>
            {allInstalls.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">No installs yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className={ad.tableHeadRow}>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Design</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Installed</th>
                  </tr>
                </thead>
                <tbody>
                  {allInstalls.map((install) => (
                    <tr key={install.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {nameByLocationId[install.location_id] ?? install.location_id}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{install.design_slug ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                            install.status === 'active'
                              ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800'
                              : 'border-amber-200 bg-amber-50/80 text-amber-800'
                          }`}
                        >
                          {install.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {install.installed_at ? new Date(install.installed_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
