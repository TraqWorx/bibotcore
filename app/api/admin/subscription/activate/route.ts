import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { PLAN } from '@/lib/stripe/plans'

export async function POST(req: NextRequest) {
  const { locationId } = await req.json()
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('role, agency_id').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  if (!profile.agency_id) return NextResponse.json({ error: 'No agency' }, { status: 403 })

  await sb.from('agency_subscriptions').upsert({
    agency_id: profile.agency_id,
    location_id: locationId,
    plan: PLAN.id,
    status: 'active',
    price_cents: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'agency_id,location_id' })

  return NextResponse.json({ ok: true })
}
