import { createAdminClient } from '@/lib/supabase-server'

export default async function PlatformRevenuePage() {
  const sb = createAdminClient()

  const [{ data: subscriptions }, { data: agencies }] = await Promise.all([
    sb.from('agency_subscriptions').select('agency_id, plan, status, price_cents, created_at'),
    sb.from('agencies').select('id, name'),
  ])

  const active = (subscriptions ?? []).filter((s) => s.status === 'active')
  const mrr = active.reduce((sum, s) => sum + s.price_cents, 0)
  const basicCount = active.filter((s) => s.plan === 'basic').length
  const proCount = active.filter((s) => s.plan === 'pro').length
  const canceled = (subscriptions ?? []).filter((s) => s.status === 'canceled').length
  const totalSubs = (subscriptions ?? []).length
  const churnRate = totalSubs > 0 ? ((canceled / totalSubs) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Revenue</h1>
        <p className="mt-1 text-sm text-gray-500">Platform-wide financial overview</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">MRR</p>
          <p className="mt-2 text-3xl font-black text-emerald-600">${(mrr / 100).toFixed(0)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Active Locations</p>
          <p className="mt-2 text-3xl font-black text-gray-900">{active.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Plan Split</p>
          <p className="mt-2 text-lg font-bold text-gray-900">
            <span className="text-gray-500">{basicCount} Basic</span>
            <span className="mx-2 text-gray-300">/</span>
            <span className="text-brand">{proCount} Pro</span>
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Churn Rate</p>
          <p className={`mt-2 text-3xl font-black ${Number(churnRate) > 5 ? 'text-red-600' : 'text-emerald-600'}`}>{churnRate}%</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-bold text-gray-900">Revenue by Agency</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
              <th className="px-5 py-3">Agency</th>
              <th className="px-5 py-3 text-center">Locations</th>
              <th className="px-5 py-3 text-right">MRR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(agencies ?? []).map((agency) => {
              const agencySubs = active.filter((s) => s.agency_id === agency.id)
              const agencyMrr = agencySubs.reduce((sum, s) => sum + s.price_cents, 0)
              if (agencySubs.length === 0) return null
              return (
                <tr key={agency.id}>
                  <td className="px-5 py-3.5 font-semibold text-gray-900">{agency.name}</td>
                  <td className="px-5 py-3.5 text-center">{agencySubs.length}</td>
                  <td className="px-5 py-3.5 text-right font-bold tabular-nums text-brand">${(agencyMrr / 100).toFixed(0)}/mo</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
