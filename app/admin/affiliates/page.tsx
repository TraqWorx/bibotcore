import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { ad } from '@/lib/admin/ui'

export const dynamic = 'force-dynamic'

const GHL_BASE = 'https://services.leadconnectorhq.com'

interface Affiliate {
  id: string
  name?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  status?: string
  totalRevenue?: number
  totalPaid?: number
  totalDue?: number
  createdAt?: string
  [key: string]: unknown
}

async function fetchAffiliates(locationId: string, token: string): Promise<Affiliate[]> {
  try {
    const res = await fetch(`${GHL_BASE}/affiliate-manager/${locationId}/affiliates`, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error(`[affiliates] GHL ${locationId} error:`, res.status)
      return []
    }
    const data = await res.json()
    return (data?.affiliates ?? data?.data ?? []) as Affiliate[]
  } catch (err) {
    console.error('[affiliates] fetch error:', err)
    return []
  }
}

function formatCurrency(cents: number | undefined | null): string {
  if (cents == null) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

export default async function AffiliatesPage() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id').eq('id', user.id).single()
  if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) redirect('/admin')

  // Fetch affiliates from all connected locations
  const { data: connections } = await sb
    .from('ghl_connections')
    .select('location_id, access_token, refresh_token, expires_at')
    .not('refresh_token', 'is', null)

  const allAffiliates: (Affiliate & { locationId: string; locationName: string })[] = []
  const { data: locations } = await sb.from('locations').select('location_id, name').eq('agency_id', profile.agency_id)
  const nameMap = new Map((locations ?? []).map((l) => [l.location_id, l.name]))

  for (const conn of connections ?? []) {
    const token = await refreshIfNeeded(conn.location_id, conn)
    const affiliates = await fetchAffiliates(conn.location_id, token)
    for (const a of affiliates) {
      allAffiliates.push({
        ...a,
        locationId: conn.location_id,
        locationName: nameMap.get(conn.location_id) ?? conn.location_id,
      })
    }
  }

  const totalOwed = allAffiliates.reduce((s, a) => s + (a.totalRevenue ?? 0), 0)
  const totalPaid = allAffiliates.reduce((s, a) => s + (a.totalPaid ?? 0), 0)
  const totalDue = allAffiliates.reduce((s, a) => s + (a.totalDue ?? 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className={ad.pageTitle}>Affiliates</h1>
        <p className={ad.pageSubtitle}>{allAffiliates.length} affiliates across {new Set(allAffiliates.map(a => a.locationId)).size} locations</p>
      </div>

      {allAffiliates.length === 0 ? (
        <div className={`${ad.panel} py-12 text-center`}>
          <p className="text-sm font-medium text-gray-500">No affiliates found</p>
          <p className="mt-1 text-xs text-gray-400">
            Make sure the affiliate scope is enabled in your GHL app and locations are re-authorized.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className={ad.panel}>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Total Owed</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{formatCurrency(totalOwed)}</p>
            </div>
            <div className={ad.panel}>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Total Paid</p>
              <p className="mt-2 text-3xl font-black text-emerald-600">{formatCurrency(totalPaid)}</p>
            </div>
            <div className={ad.panel}>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Total Due</p>
              <p className="mt-2 text-3xl font-black text-red-600">{formatCurrency(totalDue)}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <th className="px-5 py-3">Affiliate</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Owed</th>
                  <th className="px-5 py-3 text-right">Paid</th>
                  <th className="px-5 py-3 text-right">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allAffiliates.map((a) => (
                  <tr key={`${a.locationId}-${a.id}`} className="transition-colors hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      {a.name ?? (`${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || '—')}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{a.email ?? '—'}</td>
                    <td className="px-5 py-3.5 text-xs text-gray-400">{a.locationName}</td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        a.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {a.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{formatCurrency(a.totalRevenue)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-emerald-600">{formatCurrency(a.totalPaid)}</td>
                    <td className="px-5 py-3.5 text-right font-bold tabular-nums text-red-600">{formatCurrency(a.totalDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
