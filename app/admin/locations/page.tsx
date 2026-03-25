import { createAdminClient } from '@/lib/supabase-server'
import BulkConnectButton from './_components/BulkConnectButton'
import LocationsTable from './_components/LocationsTable'
import SyncSubscriptionsButton from './_components/SyncSubscriptionsButton'

const GHL_BASE = 'https://services.leadconnectorhq.com'

interface GhlLocation {
  id: string
  name: string
  dateAdded: string | null
  planId: string | null
}

// Raw GHL location object — capture every possible plan/subscription field
type RawGhlLocation = Record<string, unknown>

async function fetchAllGhlLocations(token: string, companyId?: string): Promise<GhlLocation[]> {
  const params = new URLSearchParams({ limit: '100' })
  if (companyId) params.set('companyId', companyId)
  const res = await fetch(`${GHL_BASE}/locations/search?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
    cache: 'no-store',
  })
  if (!res.ok) {
    console.error('[fetchAllGhlLocations] GHL error:', res.status, await res.text().catch(() => ''))
    return []
  }
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

export default async function LocationsPage() {
  const supabase = createAdminClient()

  const envToken = process.env.GHL_AGENCY_TOKEN
  const envCompanyId = process.env.GHL_COMPANY_ID

  const { data: integration } = await supabase
    .from('ghl_private_integrations')
    .select('api_key, company_id')
    .limit(1)
    .single()
  const dbToken = integration?.api_key ?? null
  const dbCompanyId = (integration as { company_id?: string } | null)?.company_id ?? null

  const agencyToken: string | null = envToken ?? dbToken
  const companyId: string | undefined = envCompanyId ?? dbCompanyId ?? undefined

  const [ghlLocations, { data: installs }, { data: designs }, { data: connections }, { data: userProfiles }, { data: ghlPlans }] =
    await Promise.all([
      agencyToken ? fetchAllGhlLocations(agencyToken, companyId) : Promise.resolve([]),
      supabase.from('installs').select('location_id, design_slug'),
      supabase.from('designs').select('slug, name').order('name'),
      supabase.from('ghl_connections').select('location_id, refresh_token'),
      supabase.from('profile_locations').select('location_id'),
      supabase.from('ghl_plans').select('ghl_plan_id, name, price_monthly').order('name'),
    ])

  // Retry with DB token if env token returned nothing
  if (ghlLocations.length === 0 && envToken && dbToken && dbToken !== envToken) {
    const retried = await fetchAllGhlLocations(dbToken, dbCompanyId ?? envCompanyId ?? undefined)
    if (retried.length > 0) ghlLocations.push(...retried)
  }

  // Backfill location names + plan from GHL into locations table
  if (ghlLocations.length > 0) {
    const upsertRows = ghlLocations.map((l) => {
      const row: Record<string, unknown> = {
        location_id: l.id,
        name: l.name,
      }
      if (l.planId) row.ghl_plan_id = l.planId
      if (l.dateAdded) row.ghl_date_added = l.dateAdded
      return row
    })
    await supabase.from('locations').upsert(upsertRows, { onConflict: 'location_id' })
  }

  // Read plan assignments back from locations table (covers all locations)
  const { data: locationPlanRows } = await supabase
    .from('locations')
    .select('location_id, ghl_plan_id')
    .in('location_id', ghlLocations.map((l) => l.id))

  const planByLocation: Record<string, string | null> = {}
  for (const row of locationPlanRows ?? []) {
    planByLocation[row.location_id] = (row as { location_id: string; ghl_plan_id?: string | null }).ghl_plan_id ?? null
  }

  const designByLocation: Record<string, string | null> = {}
  for (const i of installs ?? []) designByLocation[i.location_id] = i.design_slug

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
    const planId = planByLocation[l.id] ?? null
    const plan = planId ? planById[planId] ?? null : null
    return {
      id: l.id,
      name: l.name,
      connected: connectedIds.has(l.id),
      users: userCountByLocation[l.id] ?? 0,
      design: designByLocation[l.id] ?? null,
      needsOAuth: connectedIds.has(l.id) && !hasOAuthToken.has(l.id),
      dateAdded: l.dateAdded,
      planId,
      planName: plan?.name ?? (planId ? `Unknown (…${planId.slice(-6)})` : null),
      planPrice: plan?.price ?? null,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Locations</h1>
          <p className="text-sm text-gray-400">{ghlLocations.length} total</p>
        </div>
        <div className="flex items-center gap-3">
          <SyncSubscriptionsButton />
          <BulkConnectButton designs={designsList} unconnectedLocations={unconnectedLocations} />
        </div>
      </div>

      {!agencyToken ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-red-500">
            No GHL agency token configured. Set <code>GHL_AGENCY_TOKEN</code> in your environment variables.
          </p>
        </div>
      ) : ghlLocations.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-400">No locations found in GHL agency.</p>
        </div>
      ) : (
        <LocationsTable rows={rows} designs={designsList} unconnectedLocations={unconnectedLocations} />
      )}
    </div>
  )
}
