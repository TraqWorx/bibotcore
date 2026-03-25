import { NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

const BASE = 'https://services.leadconnectorhq.com'

async function ghlGet(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
    cache: 'no-store',
  })
  return { status: res.status, body: res.ok ? await res.json().catch(() => null) : await res.text().catch(() => null) }
}

export async function GET() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = process.env.GHL_AGENCY_TOKEN!
  const companyId = process.env.GHL_COMPANY_ID!

  const [plansRes, locationsRes] = await Promise.all([
    ghlGet(`/saas/agency-plans/${companyId}`, token),
    ghlGet(`/locations/search?limit=3&companyId=${companyId}`, token),
  ])

  const firstLocation = locationsRes.body?.locations?.[0] ?? null

  // Check what keys the plans body has (it might be agencyPlans, data, etc.)
  const plansBodyKeys = plansRes.body ? Object.keys(plansRes.body) : []
  // Try all possible plan array locations
  const plansArray = plansRes.body?.plans ?? plansRes.body?.agencyPlans ?? plansRes.body?.data ?? null
  const firstPlan = Array.isArray(plansArray) ? plansArray[0] : null

  // Show what settings looks like in the search result (not just keys)
  const firstLocationSettings = firstLocation?.settings ?? null

  // Check DB state
  const { data: dbPlans } = await supabase.from('ghl_plans').select('ghl_plan_id, name, price_monthly').limit(10)
  const { data: dbLocationPlans } = await supabase
    .from('locations')
    .select('location_id, name, ghl_plan_id')
    .not('ghl_plan_id', 'is', null)
    .limit(5)
  const { data: dbLocationsNoplan } = await supabase
    .from('locations')
    .select('location_id, ghl_plan_id')
    .is('ghl_plan_id', null)
    .limit(3)

  return NextResponse.json({
    '1_plans_api_status': plansRes.status,
    '2_plans_body_keys': plansBodyKeys,
    '3_first_plan': firstPlan,
    '4_plans_count': Array.isArray(plansArray) ? plansArray.length : 0,
    '5_first_location_settings': firstLocationSettings,
    '6_db_ghl_plans': dbPlans,
    '7_db_locations_with_plan': dbLocationPlans,
    '8_db_locations_without_plan_sample': dbLocationsNoplan,
  }, { status: 200 })
}
