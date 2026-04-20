import { createAdminClient } from '@/lib/supabase-server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PlatformAgenciesPage() {
  const sb = createAdminClient()

  const [{ data: agencies }, { data: subscriptions }, { data: locations }] = await Promise.all([
    sb.from('agencies').select('id, name, email, created_at').order('created_at', { ascending: false }),
    sb.from('agency_subscriptions').select('agency_id, status, price_cents'),
    sb.from('locations').select('location_id, agency_id'),
  ])

  const locCountByAgency = new Map<string, number>()
  for (const loc of locations ?? []) {
    if (loc.agency_id) locCountByAgency.set(loc.agency_id, (locCountByAgency.get(loc.agency_id) ?? 0) + 1)
  }

  const subsByAgency = new Map<string, { active: number; mrr: number }>()
  for (const sub of subscriptions ?? []) {
    const existing = subsByAgency.get(sub.agency_id) ?? { active: 0, mrr: 0 }
    if (sub.status === 'active') {
      existing.active++
      existing.mrr += sub.price_cents
    }
    subsByAgency.set(sub.agency_id, existing)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Agencies</h1>
        <p className="mt-1 text-sm text-gray-500">{(agencies ?? []).length} agencies registered</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
              <th className="px-5 py-3">Agency</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3 text-center">Locations</th>
              <th className="px-5 py-3 text-center">Active Subs</th>
              <th className="px-5 py-3 text-right">MRR</th>
              <th className="px-5 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(agencies ?? []).map((agency) => {
              const stats = subsByAgency.get(agency.id) ?? { active: 0, mrr: 0 }
              const locCount = locCountByAgency.get(agency.id) ?? 0
              return (
                <tr key={agency.id} className="transition-colors hover:bg-gray-50/50">
                  <td className="px-5 py-3.5">
                    <Link href={`/platform/agencies/${agency.id}`} className="font-semibold text-gray-900 hover:text-brand">
                      {agency.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{agency.email}</td>
                  <td className="px-5 py-3.5 text-center font-semibold">{locCount}</td>
                  <td className="px-5 py-3.5 text-center font-semibold text-emerald-600">{stats.active}</td>
                  <td className="px-5 py-3.5 text-right font-bold tabular-nums text-brand">${(stats.mrr / 100).toFixed(0)}</td>
                  <td className="px-5 py-3.5 text-gray-400">
                    {new Date(agency.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
