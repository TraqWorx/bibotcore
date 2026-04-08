import { NextResponse } from 'next/server'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'
import { fetchGhlPlans } from '@/lib/ghl/getGhlPlans'

/**
 * GET /api/admin/sync-ghl-plans
 * Syncs GHL SaaS plans into ghl_plans table.
 *
 * Calls: GET /saas/agency-plans/:companyId
 *
 * Requires companyId + agency token. Resolution order:
 *   1. GHL_AGENCY_TOKEN + GHL_COMPANY_ID env vars
 *   2. api_key + company_id from ghl_private_integrations table
 */
export async function GET() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin' && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // Resolve token + companyId: env vars first, DB fallback
  // Query api_key and company_id separately so a missing column doesn't null out both
  let agencyToken = process.env.GHL_AGENCY_TOKEN
  let companyId = process.env.GHL_COMPANY_ID

  if (!agencyToken || !companyId) {
    // Select only api_key first (always exists)
    const { data: keyRow } = await supabase
      .from('ghl_private_integrations')
      .select('api_key')
      .limit(1)
      .single()
    agencyToken ??= keyRow?.api_key ?? undefined

    // Select company_id separately (added in migration 020)
    const { data: cidRow } = await supabase
      .from('ghl_private_integrations')
      .select('company_id')
      .limit(1)
      .single()
    companyId ??= (cidRow as { company_id?: string } | null)?.company_id ?? undefined
  }

  if (!agencyToken) {
    return NextResponse.json(
      { error: 'No agency token. Set GHL_AGENCY_TOKEN env var or store in ghl_private_integrations.' },
      { status: 400 }
    )
  }
  if (!companyId) {
    return NextResponse.json(
      { error: 'No company ID. Set GHL_COMPANY_ID env var or add company_id to ghl_private_integrations.' },
      { status: 400 }
    )
  }

  let plans: { id: string; name: string }[]
  let debugRaw: unknown
  try {
    const result = await fetchGhlPlans(agencyToken, companyId)
    plans = result.plans
    debugRaw = result.raw
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 502 })
  }

  if (plans.length === 0) {
    return NextResponse.json({ synced: 0, debug_raw: debugRaw })
  }

  const { error } = await supabase
    .from('ghl_plans')
    .upsert(
      plans.map((p) => ({ ghl_plan_id: p.id, name: p.name })),
      { onConflict: 'ghl_plan_id' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ synced: plans.length })
}
