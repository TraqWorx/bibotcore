import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { isBibotAgency } from '@/lib/isBibotAgency'
import BulkConnectButton from './_components/BulkConnectButton'
import LocationsTable from './_components/LocationsTable'
import SyncSubscriptionsButton from './_components/SyncSubscriptionsButton'
import AddLocationForm from './_components/AddLocationForm'
import { ad } from '@/lib/admin/ui'

const GHL_BASE = 'https://services.leadconnectorhq.com'

function paymentsMade(iso: string, until?: string): number {
  const start = new Date(iso)
  const end = until ? new Date(until) : new Date()
  const billingDay = start.getDate()
  let payments = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    payments++
    cursor.setMonth(cursor.getMonth() + 1)
    cursor.setDate(billingDay)
  }
  return Math.max(1, payments)
}

interface GhlLocation {
  id: string
  name: string
  dateAdded: string | null
  planId: string | null
}

type RawGhlLocation = Record<string, unknown>

async function fetchAllGhlLocations(token: string, companyId?: string): Promise<GhlLocation[]> {
  const params = new URLSearchParams({ limit: '100' })
  if (companyId) params.set('companyId', companyId)
  const res = await fetch(`${GHL_BASE}/locations/search?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data?.locations ?? []).map((l: RawGhlLocation) => {
    const saasSettings = (l.settings as { saasSettings?: { saasPlanId?: string } } | null)?.saasSettings
    const planId = (saasSettings?.saasPlanId ?? null) as string | null
    const dateAdded = (l.dateAdded ?? l.date_added ?? l.created ?? l.createdAt ?? l.created_at ?? null) as string | null
    return {
      id: (l.id ?? '') as string,
      name: ((l.name ?? l.id) as string),
      dateAdded,
      planId,
    }
  })
}

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>
}) {
  const sp = await searchParams
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('agency_id').eq('id', user.id).single()
  if (!profile?.agency_id) redirect('/login')

  const agencyId = profile.agency_id
  const isBibot = isBibotAgency(agencyId)

  // ── Fetch locations ──
  let ghlLocations: GhlLocation[] = []

  if (isBibot) {
    // Bibot: fetch all from GHL agency token
    const envToken = process.env.GHL_AGENCY_TOKEN
    const envCompanyId = process.env.GHL_COMPANY_ID
    if (envToken) {
      ghlLocations = await fetchAllGhlLocations(envToken, envCompanyId)
    }
    // Backfill location names
    if (ghlLocations.length > 0) {
      const upsertRows = ghlLocations.map((l) => ({
        location_id: l.id,
        name: l.name,
        agency_id: agencyId,
        ...(l.dateAdded ? { ghl_date_added: l.dateAdded } : {}),
      }))
      await supabase.from('locations').upsert(upsertRows, { onConflict: 'location_id' })
    }
  } else {
    // Regular agency: only show locations connected via OAuth
    const { data: agencyLocations } = await supabase
      .from('locations')
      .select('location_id, name, ghl_date_added')
      .eq('agency_id', agencyId)
    ghlLocations = (agencyLocations ?? []).map((l) => ({
      id: l.location_id,
      name: l.name ?? l.location_id,
      dateAdded: l.ghl_date_added ?? null,
      planId: null,
    }))
  }

  // ── Common data loading ──
  const locationIds = ghlLocations.map((l) => l.id)

  const [{ data: installs }, { data: designs }, { data: connections }, { data: userProfiles }, { data: ghlPlans }, { data: dashboardConfigs }, { data: subscriptions }] =
    await Promise.all([
      locationIds.length ? supabase.from('installs').select('location_id, design_slug').in('location_id', locationIds) : Promise.resolve({ data: [] }),
      supabase.from('designs').select('slug, name').order('name'),
      locationIds.length ? supabase.from('ghl_connections').select('location_id, refresh_token').in('location_id', locationIds) : Promise.resolve({ data: [] }),
      locationIds.length ? supabase.from('profile_locations').select('location_id').in('location_id', locationIds) : Promise.resolve({ data: [] }),
      supabase.from('ghl_plans').select('ghl_plan_id, name, price_monthly').order('name'),
      locationIds.length ? supabase.from('dashboard_configs').select('location_id, embed_token, config').in('location_id', locationIds) : Promise.resolve({ data: [] }),
      locationIds.length ? supabase.from('agency_subscriptions').select('location_id, status').eq('agency_id', agencyId).eq('status', 'active').in('location_id', locationIds) : Promise.resolve({ data: [] }),
    ])

  const subscribedIds = new Set((subscriptions ?? []).map((s) => s.location_id))

  // Plan assignments from locations table
  const { data: locationPlanRows } = locationIds.length
    ? await supabase.from('locations').select('location_id, ghl_plan_id, ghl_date_added, churned_at').in('location_id', locationIds)
    : { data: [] }

  const planByLocation: Record<string, string | null> = {}
  const churnedLocations = new Set<string>()
  const locationMeta: Record<string, { ghl_date_added?: string | null; churned_at?: string | null }> = {}
  for (const row of locationPlanRows ?? []) {
    const r = row as { location_id: string; ghl_plan_id?: string | null; ghl_date_added?: string | null; churned_at?: string | null }
    planByLocation[r.location_id] = r.ghl_plan_id ?? null
    locationMeta[r.location_id] = { ghl_date_added: r.ghl_date_added, churned_at: r.churned_at }
    if (r.churned_at) churnedLocations.add(r.location_id)
  }

  const designByLocation: Record<string, string | null> = {}
  for (const i of installs ?? []) designByLocation[i.location_id] = i.design_slug

  const dashboardByLocation: Record<string, { token: string; widgetCount: number }> = {}
  for (const c of dashboardConfigs ?? []) {
    dashboardByLocation[c.location_id] = {
      token: c.embed_token,
      widgetCount: Array.isArray(c.config) ? c.config.length : 0,
    }
  }

  const userCountByLocation: Record<string, number> = {}
  for (const pl of userProfiles ?? []) {
    userCountByLocation[pl.location_id] = (userCountByLocation[pl.location_id] ?? 0) + 1
  }

  const planById: Record<string, { name: string; price: number | null }> = {}
  for (const p of ghlPlans ?? []) {
    planById[p.ghl_plan_id] = { name: p.name, price: p.price_monthly != null ? Number(p.price_monthly) : null }
  }

  const connectedIds = new Set((connections ?? []).map((c) => c.location_id))
  const hasOAuthToken = new Set(
    (connections ?? []).filter((c) => !!c.refresh_token).map((c) => c.location_id)
  )
  const designsList = designs ?? []
  const unconnectedLocations = ghlLocations.filter((l) => !connectedIds.has(l.id))

  const rows = ghlLocations.map((l) => {
    const planId = planByLocation[l.id] ?? l.planId ?? null
    const churned = churnedLocations.has(l.id)
    const plan = planId ? planById[planId] ?? null : null
    const meta = locationMeta[l.id]
    const startDate = meta?.ghl_date_added ?? l.dateAdded
    const price = plan?.price ?? null
    let totalPaid: number | null = null
    if (planId && price != null && startDate) {
      const months = paymentsMade(startDate, meta?.churned_at ?? undefined)
      totalPaid = price * months
    }
    return {
      id: l.id,
      name: l.name,
      connected: connectedIds.has(l.id),
      subscribed: isBibot || subscribedIds.has(l.id),
      users: userCountByLocation[l.id] ?? 0,
      design: designByLocation[l.id] ?? null,
      dashboard: dashboardByLocation[l.id] ?? null,
      needsOAuth: connectedIds.has(l.id) && !hasOAuthToken.has(l.id),
      dateAdded: l.dateAdded,
      planId: churned ? null : planId,
      planName: churned ? null : (plan?.name ?? (planId ? `Unknown (…${planId.slice(-6)})` : null)),
      planPrice: churned ? null : (plan?.price ?? null),
      totalPaid,
      totalPaidVat: totalPaid != null ? Math.round(totalPaid * 1.22 * 100) / 100 : null,
      churned,
    }
  })

  return (
    <div className="space-y-6">
      {sp.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{sp.error}</div>
      )}
      {sp.connected && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">Location connected successfully!</div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={ad.pageTitle}>Locations</h1>
          <p className={ad.pageSubtitle}>{ghlLocations.length} total</p>
        </div>
        <div className="flex items-center gap-3">
          {isBibot && <SyncSubscriptionsButton />}
          {isBibot ? (
            <BulkConnectButton designs={designsList} unconnectedLocations={unconnectedLocations} />
          ) : (
            <AddLocationForm />
          )}
        </div>
      </div>

      {ghlLocations.length === 0 ? (
        <div className={`${ad.panel} py-16 text-center`}>
          <div className="mx-auto max-w-sm">
            <p className="text-sm font-medium text-gray-900">No locations yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Add your first GHL location ID to get started.
            </p>
            <div className="mt-6">
              <AddLocationForm />
            </div>
          </div>
        </div>
      ) : (
        <LocationsTable rows={rows} designs={designsList} unconnectedLocations={unconnectedLocations} />
      )}
    </div>
  )
}
