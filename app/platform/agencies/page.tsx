import { createAdminClient } from '@/lib/supabase-server'
import Link from 'next/link'
import InvitePanel from './_components/InvitePanel'
import DeleteAgencyButton from './_components/DeleteAgencyButton'
import AgencyActiveToggle from './_components/AgencyActiveToggle'
import { BIBOT_AGENCY_ID } from '@/lib/isBibotAgency'

export const dynamic = 'force-dynamic'

export default async function PlatformAgenciesPage() {
  const sb = createAdminClient()

  const [{ data: agencies }, { data: subscriptions }, { data: locations }, { data: profileRows }] = await Promise.all([
    sb.from('agencies').select('id, name, email, created_at').order('created_at', { ascending: false }),
    sb.from('agency_subscriptions').select('agency_id, status, price_cents'),
    sb.from('locations').select('location_id, agency_id'),
    sb.from('profiles').select('id, agency_id'),
  ])

  // Deactivation state = all of an agency's users are banned (auth-level).
  const bannedIds = new Set<string>()
  for (let page = 1; page < 20; page++) {
    const { data: list } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    const users = list?.users ?? []
    for (const u of users) {
      const bu = (u as { banned_until?: string }).banned_until
      if (bu && new Date(bu).getTime() > Date.now()) bannedIds.add(u.id)
    }
    if (users.length < 1000) break
  }
  const profilesByAgency = new Map<string, string[]>()
  for (const p of profileRows ?? []) {
    if (!p.agency_id) continue
    const arr = profilesByAgency.get(p.agency_id) ?? []
    arr.push(p.id)
    profilesByAgency.set(p.agency_id, arr)
  }
  const isDeactivated = (agencyId: string) => {
    const ids = profilesByAgency.get(agencyId) ?? []
    return ids.length > 0 && ids.every((id) => bannedIds.has(id))
  }

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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Agencies</h1>
          <p className="mt-1 text-sm text-gray-500">{(agencies ?? []).length} agencies registered</p>
        </div>
        <InvitePanel />
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
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(agencies ?? []).map((agency) => {
              const stats = subsByAgency.get(agency.id) ?? { active: 0, mrr: 0 }
              const locCount = locCountByAgency.get(agency.id) ?? 0
              const deactivated = isDeactivated(agency.id)
              const isBibot = agency.id === BIBOT_AGENCY_ID
              return (
                <tr key={agency.id} className="transition-colors hover:bg-gray-50/50">
                  <td className="px-5 py-3.5">
                    <Link href={`/platform/agencies/${agency.id}`} className="font-semibold text-gray-900 hover:text-brand">
                      {agency.name}
                    </Link>
                    {deactivated && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">Deactivated</span>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{agency.email}</td>
                  <td className="px-5 py-3.5 text-center font-semibold">{locCount}</td>
                  <td className="px-5 py-3.5 text-center font-semibold text-emerald-600">{stats.active}</td>
                  <td className="px-5 py-3.5 text-right font-bold tabular-nums text-brand">${(stats.mrr / 100).toFixed(0)}</td>
                  <td className="px-5 py-3.5 text-gray-400">
                    {new Date(agency.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <AgencyActiveToggle agencyId={agency.id} agencyName={agency.name} deactivated={deactivated} disabled={isBibot} />
                      <DeleteAgencyButton agencyId={agency.id} agencyName={agency.name} disabled={isBibot} />
                    </div>
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
