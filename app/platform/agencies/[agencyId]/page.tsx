import { createAdminClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { getStripe } from '@/lib/stripe/stripe'
import { PLAN } from '@/lib/stripe/plans'

export const dynamic = 'force-dynamic'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function monthsBetween(start: string, end?: string | null): number {
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 30)))
}

export default async function PlatformAgencyDetailPage({
  params,
}: {
  params: Promise<{ agencyId: string }>
}) {
  const { agencyId } = await params
  const sb = createAdminClient()

  const [{ data: agency }, { data: subscriptions }, { data: locations }, { data: connections }] = await Promise.all([
    sb.from('agencies').select('*').eq('id', agencyId).single(),
    sb.from('agency_subscriptions').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }),
    sb.from('locations').select('location_id, name, created_at').eq('agency_id', agencyId),
    sb.from('ghl_connections').select('location_id, status, expires_at').in(
      'location_id',
      (await sb.from('locations').select('location_id').eq('agency_id', agencyId)).data?.map(l => l.location_id) ?? []
    ),
  ])

  if (!agency) notFound()

  const locationMap = new Map((locations ?? []).map((l) => [l.location_id, { name: l.name, createdAt: l.created_at }]))
  const connectionMap = new Map((connections ?? []).map((c) => [c.location_id, c]))
  const subMap = new Map((subscriptions ?? []).map((s) => [s.location_id, s]))

  const activeCount = (subscriptions ?? []).filter((s) => s.status === 'active').length
  const mrr = (subscriptions ?? []).filter((s) => s.status === 'active').reduce((sum, s) => sum + s.price_cents, 0)
  const totalPaid = (subscriptions ?? []).reduce((sum, s) => {
    const months = monthsBetween(s.created_at, s.status === 'canceled' ? s.updated_at : null)
    return sum + (s.price_cents * months)
  }, 0)

  // Server actions for admin controls
  async function activateLocation(formData: FormData) {
    'use server'
    const locationId = formData.get('locationId') as string
    const sb = createAdminClient()
    await sb.from('agency_subscriptions').upsert({
      agency_id: agencyId,
      location_id: locationId,
      plan: PLAN.id,
      status: 'active',
      price_cents: PLAN.priceCents,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'agency_id,location_id' })
    revalidatePath(`/platform/agencies/${agencyId}`)
  }

  async function deactivateLocation(formData: FormData) {
    'use server'
    const locationId = formData.get('locationId') as string
    const sb = createAdminClient()
    // Cancel Stripe subscription if exists
    const { data: sub } = await sb.from('agency_subscriptions').select('stripe_subscription_id').eq('agency_id', agencyId).eq('location_id', locationId).single()
    if (sub?.stripe_subscription_id) {
      try {
        const stripe = getStripe()
        await stripe.subscriptions.cancel(sub.stripe_subscription_id)
      } catch (err) {
        console.error('[platform] stripe cancel failed:', err)
      }
    }
    await sb.from('agency_subscriptions').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('agency_id', agencyId).eq('location_id', locationId)
    revalidatePath(`/platform/agencies/${agencyId}`)
  }

  // All location IDs (from locations table)
  const allLocationIds = (locations ?? []).map((l) => l.location_id)

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/platform/agencies" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" /></svg>
        Back to Agencies
      </Link>

      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Agency</p>
        <h1 className="mt-1 text-xl font-bold text-gray-900">{agency.name}</h1>
        <p className="mt-1 text-sm text-gray-500">{agency.email}</p>
        {agency.stripe_customer_id && (
          <p className="mt-0.5 font-mono text-[10px] text-gray-300">Stripe: {agency.stripe_customer_id}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Locations</p>
          <p className="mt-2 text-3xl font-black text-gray-900">{allLocationIds.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Active</p>
          <p className="mt-2 text-3xl font-black text-emerald-600">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">MRR</p>
          <p className="mt-2 text-3xl font-black text-brand">${(mrr / 100).toFixed(0)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Total Paid</p>
          <p className="mt-2 text-3xl font-black text-gray-900">${(totalPaid / 100).toFixed(0)}</p>
        </div>
      </div>

      {/* Agency Info */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Details</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase text-gray-400">Joined</dt>
            <dd className="mt-0.5 text-gray-900">{formatDate(agency.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-gray-400">Owner ID</dt>
            <dd className="mt-0.5 font-mono text-xs text-gray-500">{agency.owner_user_id ?? '—'}</dd>
          </div>
          {agency.billing_name && (
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-400">Billing Name</dt>
              <dd className="mt-0.5 text-gray-900">{agency.billing_name}</dd>
            </div>
          )}
          {agency.billing_vat && (
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-400">VAT</dt>
              <dd className="mt-0.5 text-gray-900">{agency.billing_vat}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Locations Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-bold text-gray-900">Locations</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
              <th className="px-5 py-3">Location</th>
              <th className="px-5 py-3">Location ID</th>
              <th className="px-5 py-3">GHL</th>
              <th className="px-5 py-3">Subscription</th>
              <th className="px-5 py-3 text-right">Price</th>
              <th className="px-5 py-3">Since</th>
              <th className="px-5 py-3 text-right">Total Paid</th>
              <th className="px-5 py-3 text-right">Refunded</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {allLocationIds.map((locId) => {
              const loc = locationMap.get(locId)
              const conn = connectionMap.get(locId)
              const sub = subMap.get(locId)
              const isActive = sub?.status === 'active'
              const isConnected = !!conn
              const months = sub ? monthsBetween(sub.created_at, sub.status === 'canceled' ? sub.updated_at : null) : 0
              const locTotalPaid = sub ? (sub.price_cents * months) / 100 : 0

              return (
                <tr key={locId} className="transition-colors hover:bg-gray-50/50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{loc?.name ?? locId}</td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-gray-400">{locId}</td>
                  <td className="px-5 py-3.5">
                    {isConnected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-300">Not connected</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {sub ? (
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {sub.status}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-300">None</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                    {sub ? `$${(sub.price_cents / 100).toFixed(0)}/mo` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">
                    {sub ? formatDate(sub.created_at) : loc?.createdAt ? formatDate(loc.createdAt) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold tabular-nums text-gray-900">
                    {locTotalPaid > 0 ? `$${locTotalPaid.toFixed(0)}` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold tabular-nums text-red-600">
                    {sub?.refunded_cents ? `$${(sub.refunded_cents / 100).toFixed(0)}` : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    {isActive ? (
                      <form action={deactivateLocation}>
                        <input type="hidden" name="locationId" value={locId} />
                        <button type="submit" className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">
                          Deactivate
                        </button>
                      </form>
                    ) : (
                      <form action={activateLocation}>
                        <input type="hidden" name="locationId" value={locId} />
                        <button type="submit" className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50">
                          Activate
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              )
            })}
            {allLocationIds.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-gray-400">No locations</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
