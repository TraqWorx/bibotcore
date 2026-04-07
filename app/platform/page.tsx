import { createAdminClient } from '@/lib/supabase-server'

export default async function PlatformOverviewPage() {
  const sb = createAdminClient()

  const [{ data: agencies }, { data: subscriptions }] = await Promise.all([
    sb.from('agencies').select('id, name, email, created_at').order('created_at', { ascending: false }),
    sb.from('agency_subscriptions').select('agency_id, plan, status, price_cents'),
  ])

  const active = (subscriptions ?? []).filter((s) => s.status === 'active')
  const mrr = active.reduce((sum, s) => sum + s.price_cents, 0)
  const basicCount = active.filter((s) => s.plan === 'basic').length
  const proCount = active.filter((s) => s.plan === 'pro').length
  const canceled = (subscriptions ?? []).filter((s) => s.status === 'canceled').length
  const totalSubs = (subscriptions ?? []).length
  const churnRate = totalSubs > 0 ? ((canceled / totalSubs) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">GHL Dash</h1>
        <p className="mt-1 text-sm text-gray-500">All agencies, subscriptions, and revenue at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Agencies</p>
          <p className="mt-2 text-3xl font-black text-gray-900">{(agencies ?? []).length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Active Subs</p>
          <p className="mt-2 text-3xl font-black text-gray-900">{active.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">MRR</p>
          <p className="mt-2 text-3xl font-black text-emerald-600">${(mrr / 100).toFixed(0)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Plans</p>
          <p className="mt-2 text-lg font-bold">
            <span className="text-gray-500">{basicCount} Basic</span>
            <span className="mx-1.5 text-gray-300">/</span>
            <span className="text-brand">{proCount} Pro</span>
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Churn</p>
          <p className={`mt-2 text-3xl font-black ${Number(churnRate) > 5 ? 'text-red-600' : 'text-emerald-600'}`}>{churnRate}%</p>
        </div>
      </div>
    </div>
  )
}
