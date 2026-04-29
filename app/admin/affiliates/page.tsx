import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
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
  planName?: string
  planPrice?: number
  locationName?: string
}

interface AffiliateDisplay extends Affiliate {
  locationId: string
  locationName: string
  commissionPercent: number | null
  customers: AffiliateCustomer[]
}

type IssueKind = 'scope_missing' | 'auth_failed' | 'other'

interface ConnectionIssue {
  locationId: string
  locationName: string
  kind: IssueKind
  status: number
  detail: string
}

function classify(status: number, body: string): IssueKind {
  if (status === 401) {
    if (/scope/i.test(body)) return 'scope_missing'
    return 'auth_failed'
  }
  return 'other'
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

async function fetchAffiliateDetails(locationId: string, locToken: string, affiliate: Affiliate, planLookup: (email: string) => { planName: string; planPrice: number; locationName: string } | null): Promise<{ commissionPercent: number | null; customers: AffiliateCustomer[] }> {
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
      customers = (custData.customers ?? []).map((c: Record<string, unknown>) => {
        const email = c.email as string | undefined
        const plan = email ? planLookup(email) : null
        return {
          firstName: c.firstName as string | undefined,
          lastName: c.lastName as string | undefined,
          email,
          createdAt: c.createdAt as string | undefined,
          type: c.type as string | undefined,
          planName: plan?.planName,
          planPrice: plan?.planPrice,
          locationName: plan?.locationName,
        }
      })
    }
  } catch { /* ignore */ }
  return { commissionPercent, customers }
}

async function fetchAffiliates(
  locationId: string,
  token: string,
  companyId: string
): Promise<{ affiliates: Affiliate[]; issue?: { kind: IssueKind; status: number; detail: string } }> {
  try {
    let res = await fetch(`${GHL_BASE}/affiliate-manager/${locationId}/affiliates`, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
      cache: 'no-store',
    })

    if (res.status === 401) {
      const locToken = await getLocationToken(token, locationId, companyId)
      if (locToken) {
        res = await fetch(`${GHL_BASE}/affiliate-manager/${locationId}/affiliates`, {
          headers: { Authorization: `Bearer ${locToken}`, Version: '2021-07-28' },
          cache: 'no-store',
        })
      }
    }

    if (!res.ok) {
      const body = await res.text()
      console.error(`[affiliates] ${locationId} -> ${res.status} ${body.slice(0, 200)}`)
      return { affiliates: [], issue: { kind: classify(res.status, body), status: res.status, detail: body.slice(0, 200) } }
    }
    const data = await res.json()
    return { affiliates: (data?.affiliates ?? data?.data ?? []) as Affiliate[] }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[affiliates] fetch error:', err)
    return { affiliates: [], issue: { kind: 'other', status: 0, detail } }
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
  const issues: ConnectionIssue[] = []
  const { data: locations } = await sb.from('locations').select('location_id, name, ghl_plan_id').eq('agency_id', profile.agency_id)
  const nameMap = new Map((locations ?? []).map((l) => [l.location_id, l.name]))

  // Build plan lookup: email → { planName, planPrice }
  const { data: ghlPlans } = await sb.from('ghl_plans').select('ghl_plan_id, name, price_monthly')
  const planById: Record<string, { name: string; price: number }> = {}
  for (const p of ghlPlans ?? []) {
    if (p.price_monthly != null) planById[p.ghl_plan_id] = { name: p.name, price: Number(p.price_monthly) }
  }

  const { data: profiles } = await sb.from('profiles').select('email, location_id').eq('agency_id', profile.agency_id)
  const emailToPlan = new Map<string, { planName: string; planPrice: number; locationName: string }>()
  for (const p of profiles ?? []) {
    if (p.email && p.location_id) {
      const loc = (locations ?? []).find((l) => l.location_id === p.location_id)
      const locName = nameMap.get(p.location_id) ?? p.location_id
      if (loc?.ghl_plan_id && planById[loc.ghl_plan_id]) {
        emailToPlan.set(p.email.toLowerCase(), { planName: planById[loc.ghl_plan_id].name, planPrice: planById[loc.ghl_plan_id].price, locationName: locName })
      } else {
        emailToPlan.set(p.email.toLowerCase(), { planName: '', planPrice: 0, locationName: locName })
      }
    }
  }
  const planLookup = (email: string) => emailToPlan.get(email.toLowerCase()) ?? null

  for (const conn of connections ?? []) {
    const token = await refreshIfNeeded(conn.location_id, conn)
    const cid = conn.company_id ?? companyId
    const { affiliates, issue } = await fetchAffiliates(conn.location_id, token, cid)
    if (issue) {
      issues.push({
        locationId: conn.location_id,
        locationName: nameMap.get(conn.location_id) ?? conn.location_id,
        kind: issue.kind,
        status: issue.status,
        detail: issue.detail,
      })
    }
    // Get location token for detail fetches (use raw company token, not refreshed)
    const locToken = await getLocationToken(conn.access_token, conn.location_id, cid)
    for (const a of affiliates) {
      let details = { commissionPercent: null as number | null, customers: [] as AffiliateCustomer[] }
      if (locToken) {
        details = await fetchAffiliateDetails(conn.location_id, locToken, a, planLookup)
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

  const totalConnections = (connections ?? []).length
  const okConnections = totalConnections - issues.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className={ad.pageTitle}>Affiliates</h1>
        <p className={ad.pageSubtitle}>
          {allAffiliates.length} affiliates across {new Set(allAffiliates.map(a => a.locationId)).size} locations
          {totalConnections > 0 && (
            <> · {okConnections}/{totalConnections} connections OK{issues.length > 0 && <> · <span className="font-semibold text-amber-700">{issues.length} need attention</span></>}</>
          )}
        </p>
      </div>

      {issues.length > 0 && (
        <div className="rounded-3xl border border-amber-300/70 bg-amber-50/80 p-5 shadow-sm sm:p-6">
          <p className="text-sm font-bold text-amber-900">Some locations couldn&apos;t load affiliates</p>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            {issues.map((iss) => {
              const action =
                iss.kind === 'scope_missing'
                  ? 'Affiliate scope is not on this token. Re-authorize this location after the GHL app version includes the affiliate scopes.'
                  : iss.kind === 'auth_failed'
                  ? 'Connection has expired. Reconnect this location.'
                  : `Unexpected response (HTTP ${iss.status}).`
              return (
                <li key={iss.locationId} className="flex flex-col gap-1 rounded-xl bg-white/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{iss.locationName}</span>
                    <Link href="/admin/locations" className="text-xs font-bold uppercase tracking-wide text-amber-800 hover:underline">
                      Manage →
                    </Link>
                  </div>
                  <span className="text-xs text-amber-800">{action}</span>
                  <span className="font-mono text-[10px] text-amber-700/80">{iss.locationId} · {iss.detail}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {allAffiliates.length === 0 ? (
        <div className={`${ad.panel} py-12 text-center`}>
          <p className="text-sm font-medium text-gray-500">No affiliates found</p>
          <p className="mt-1 text-xs text-gray-400">
            {issues.length > 0
              ? 'Resolve the connection issues above to load affiliate data.'
              : 'No affiliates have signed up under any connected location yet.'}
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
