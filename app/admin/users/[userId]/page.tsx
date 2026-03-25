import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-server'

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
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Back to Users
        </Link>
      </div>

      {/* User header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{profile.email ?? '—'}</h1>
          <div className="mt-1 flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                profile.role === 'super_admin'
                  ? 'bg-purple-50 text-purple-700'
                  : 'bg-gray-100 text-gray-600'
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
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-6">
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
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {locationIds.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">No locations connected.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Plan</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {locationIds.map((loc) => {
                    const plan = planByLocationId[loc]
                    return (
                      <tr key={loc} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3">
                          <Link href={`/admin/locations/${loc}`} className="font-medium text-gray-900 hover:text-violet-700 transition-colors">
                            {nameByLocationId[loc] ?? loc}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {plan?.planName ?? <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold" style={{ color: plan?.price != null ? '#0e9f6e' : undefined }}>
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
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {allInstalls.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">No installs yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Design</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Installed</th>
                  </tr>
                </thead>
                <tbody>
                  {allInstalls.map((install) => (
                    <tr key={install.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {nameByLocationId[install.location_id] ?? install.location_id}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{install.design_slug ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            install.status === 'active'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-yellow-50 text-yellow-700'
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
