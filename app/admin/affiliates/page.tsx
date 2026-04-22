import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import AffiliatesTable from './_components/AffiliatesTable'
import { ad } from '@/lib/admin/ui'

export const dynamic = 'force-dynamic'

const GHL_BASE = 'https://services.leadconnectorhq.com'

interface Affiliate {
  _id: string
  id?: string
  firstName?: string
  lastName?: string
  email?: string
  active?: boolean
  revenue?: number
  paid?: number
  owned?: number // "owed" — GHL typo in their API
  customer?: number
  lead?: number
  droppedCustomer?: number
  clickCount?: string
  currency?: string
  createdAt?: string
  campaignIds?: string[]
  [key: string]: unknown
}

interface AffiliateCustomer {
  firstName?: string
  lastName?: string
  email?: string
  createdAt?: string
  type?: string
}

interface AffiliateDisplay extends Affiliate {
  locationId: string
  locationName: string
  commissionPercent: number | null
  customers: AffiliateCustomer[]
}

async function getLocationToken(companyToken: string, locationId: string, companyId: string): Promise<string | null> {
  try {
    const res = await fetch(`${GHL_BASE}/oauth/locationToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${companyToken}`,
        Version: '2021-07-28',
      },
      body: new URLSearchParams({ companyId, locationId }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.access_token ?? null
  } catch {
    return null
  }
}

async function fetchAffiliateDetails(locationId: string, locToken: string, affiliate: Affiliate): Promise<{ commissionPercent: number | null; customers: AffiliateCustomer[] }> {
  let commissionPercent: number | null = null
  let customers: AffiliateCustomer[] = []
  try {
    // Get campaign commission %
    if (affiliate.campaignIds?.[0]) {
      const campRes = await fetch(`${GHL_BASE}/affiliate-manager/${locationId}/campaigns/${affiliate.campaignIds[0]}`, {
        headers: { Authorization: `Bearer ${locToken}`, Version: '2021-07-28' },
      })
      if (campRes.ok) {
        const camp = await campRes.json()
        commissionPercent = camp.commissionV2?.[0]?.defaultCommission?.commission ?? null
      }
    }
    // Get customers
    const custRes = await fetch(`${GHL_BASE}/affiliate-manager/${locationId}/affiliates/${affiliate._id}/customers`, {
      headers: { Authorization: `Bearer ${locToken}`, Version: '2021-07-28' },
    })
    if (custRes.ok) {
      const custData = await custRes.json()
      customers = (custData.customers ?? []).map((c: Record<string, unknown>) => ({
        firstName: c.firstName as string | undefined,
        lastName: c.lastName as string | undefined,
        email: c.email as string | undefined,
        createdAt: c.createdAt as string | undefined,
        type: c.type as string | undefined,
      }))
    }
  } catch { /* ignore */ }
  return { commissionPercent, customers }
}

async function fetchAffiliates(locationId: string, token: string, companyId: string): Promise<Affiliate[]> {
  try {
    // First try with the token directly
    let res = await fetch(`${GHL_BASE}/affiliate-manager/${locationId}/affiliates`, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
      cache: 'no-store',
    })

    // If 401, try exchanging for a location token
    if (res.status === 401) {
      const locToken = await getLocationToken(token, locationId, companyId)
      if (locToken) {
        res = await fetch(`${GHL_BASE}/affiliate-manager/${locationId}/affiliates`, {
          headers: { Authorization: `Bearer ${locToken}`, Version: '2021-07-28' },
          cache: 'no-store',
        })
      }
    }

    if (!res.ok) return []
    const data = await res.json()
    return (data?.affiliates ?? data?.data ?? []) as Affiliate[]
  } catch (err) {
    console.error('[affiliates] fetch error:', err)
    return []
  }
}

function formatMoney(amount: number | undefined | null, currency?: string): string {
  if (amount == null) return '—'
  const sym = currency === 'EUR' ? '€' : '$'
  return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function AffiliatesPage() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id').eq('id', user.id).single()
  if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) redirect('/admin')

  // Fetch affiliates from all connected locations
  const companyId = process.env.GHL_COMPANY_ID ?? ''
  const { data: connections } = await sb
    .from('ghl_connections')
    .select('location_id, access_token, refresh_token, expires_at, company_id')
    .not('refresh_token', 'is', null)

  const allAffiliates: AffiliateDisplay[] = []
  const { data: locations } = await sb.from('locations').select('location_id, name').eq('agency_id', profile.agency_id)
  const nameMap = new Map((locations ?? []).map((l) => [l.location_id, l.name]))

  for (const conn of connections ?? []) {
    const token = await refreshIfNeeded(conn.location_id, conn)
    const cid = conn.company_id ?? companyId
    const affiliates = await fetchAffiliates(conn.location_id, token, cid)
    // Get location token for detail fetches
    const locToken = await getLocationToken(token, conn.location_id, cid)
    for (const a of affiliates) {
      let details = { commissionPercent: null as number | null, customers: [] as AffiliateCustomer[] }
      if (locToken) {
        details = await fetchAffiliateDetails(conn.location_id, locToken, a)
      }
      allAffiliates.push({
        ...a,
        locationId: conn.location_id,
        locationName: nameMap.get(conn.location_id) ?? conn.location_id,
        commissionPercent: details.commissionPercent,
        customers: details.customers,
      })
    }
  }

  const totalRevenue = allAffiliates.reduce((s, a) => s + (a.revenue ?? 0), 0)
  const totalPaid = allAffiliates.reduce((s, a) => s + (a.paid ?? 0), 0)
  const totalOwed = allAffiliates.reduce((s, a) => s + (a.owned ?? 0), 0)
  const totalCustomers = allAffiliates.reduce((s, a) => s + (a.customer ?? 0), 0)
  const totalLeads = allAffiliates.reduce((s, a) => s + (a.lead ?? 0), 0)
  const defaultCurrency = allAffiliates[0]?.currency

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
          <div className="grid grid-cols-5 gap-4">
            <div className={ad.panel}>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Revenue</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{formatMoney(totalRevenue, defaultCurrency)}</p>
            </div>
            <div className={ad.panel}>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Owed</p>
              <p className="mt-2 text-3xl font-black text-red-600">{formatMoney(totalOwed, defaultCurrency)}</p>
            </div>
            <div className={ad.panel}>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Paid</p>
              <p className="mt-2 text-3xl font-black text-emerald-600">{formatMoney(totalPaid, defaultCurrency)}</p>
            </div>
            <div className={ad.panel}>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Customers</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{totalCustomers}</p>
            </div>
            <div className={ad.panel}>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Leads</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{totalLeads}</p>
            </div>
          </div>

          <AffiliatesTable affiliates={allAffiliates} />
        </>
      )}
    </div>
  )
}
