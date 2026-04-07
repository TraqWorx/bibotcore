import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function AdminBillingPage() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()

  let agencyId = profile?.agency_id
  if (!agencyId && profile?.role === 'super_admin') {
    const { data: owned } = await sb.from('agencies').select('id').eq('owner_user_id', user.id).limit(1).single()
    agencyId = owned?.id ?? null
  }

  const { data: subscriptions } = await sb
    .from('agency_subscriptions')
    .select('location_id, plan, status, price_cents, created_at')
    .eq('agency_id', agencyId ?? '')
    .order('created_at', { ascending: false })

  const { data: locations } = await sb.from('locations').select('location_id, name').eq('agency_id', agencyId ?? '')
  const locationMap = new Map((locations ?? []).map((l) => [l.location_id, l.name]))

  const active = (subscriptions ?? []).filter((s) => s.status === 'active')
  const totalMonthly = active.reduce((sum, s) => sum + s.price_cents, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Billing</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your subscriptions and payment method.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Monthly Total</p>
          <p className="mt-2 text-3xl font-black text-gray-900">${(totalMonthly / 100).toFixed(0)}/mo</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Active Subscriptions</p>
          <p className="mt-2 text-3xl font-black text-brand">{active.length}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-bold text-gray-900">Subscription History</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
              <th className="px-5 py-3">Location</th>
              <th className="px-5 py-3">Plan</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Price</th>
              <th className="px-5 py-3">Since</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(subscriptions ?? []).map((sub) => (
              <tr key={`${sub.location_id}-${sub.created_at}`}>
                <td className="px-5 py-3.5 font-medium text-gray-900">{locationMap.get(sub.location_id) ?? sub.location_id}</td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${sub.plan === 'pro' ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-600'}`}>{sub.plan}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sub.status === 'active' ? 'bg-emerald-50 text-emerald-700' : sub.status === 'canceled' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>{sub.status}</span>
                </td>
                <td className="px-5 py-3.5 text-right font-semibold tabular-nums">${(sub.price_cents / 100).toFixed(0)}/mo</td>
                <td className="px-5 py-3.5 text-gray-400">{new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
              </tr>
            ))}
            {(subscriptions ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">No subscriptions yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
