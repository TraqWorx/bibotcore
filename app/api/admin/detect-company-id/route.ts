import { NextResponse } from 'next/server'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'

/**
 * GET /api/admin/detect-company-id
 * Agency PIT tokens are not tied to a user, so /users/me fails.
 * Instead we call /locations/search?limit=1 — each location carries companyId.
 * Saves the detected companyId to ghl_private_integrations.
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

  const { data: integration } = await supabase
    .from('ghl_private_integrations')
    .select('id, api_key')
    .limit(1)
    .single()

  if (!integration?.api_key) {
    return NextResponse.json({ error: 'No API key stored in ghl_private_integrations' }, { status: 400 })
  }

  const headers = {
    Authorization: `Bearer ${integration.api_key}`,
    Version: '2021-07-28',
  }

  // Agency PIT tokens — try /locations/search which includes companyId per location
  const res = await fetch(
    'https://services.leadconnectorhq.com/locations/search?limit=1',
    { headers }
  )

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `GHL /locations/search error: ${text}` }, { status: 502 })
  }

  const data = await res.json()

  // companyId is on the first location returned
  const locations: Record<string, unknown>[] = data?.locations ?? data?.data ?? []
  const companyId = locations[0]?.companyId as string | undefined

  if (!companyId) {
    return NextResponse.json({
      error: 'companyId not found — no locations returned or unexpected response shape',
      raw: data,
    }, { status: 404 })
  }

  const { error: updateError } = await supabase
    .from('ghl_private_integrations')
    .update({ company_id: companyId })
    .eq('id', integration.id)

  if (updateError) {
    return NextResponse.json({
      error: `Detected companyId=${companyId} but failed to save: ${updateError.message}. Run migration 020_ghl_private_integrations_company_id.sql first.`,
    }, { status: 500 })
  }

  return NextResponse.json({ companyId })
}
