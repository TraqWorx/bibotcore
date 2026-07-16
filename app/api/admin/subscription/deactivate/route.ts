import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe/stripe'

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

  // Cancel the live Stripe subscription too, otherwise Stripe keeps billing and
  // the next renewal webhook flips this row back to 'active'.
  const { data: sub } = await sb.from('agency_subscriptions')
    .select('stripe_subscription_id')
    .eq('agency_id', profile.agency_id)
    .eq('location_id', locationId)
    .maybeSingle()
  if (sub?.stripe_subscription_id) {
    try {
      await getStripe().subscriptions.cancel(sub.stripe_subscription_id)
    } catch (err) {
      console.error('[subscription/deactivate] Stripe cancel failed:', err)
    }
  }

  await sb.from('agency_subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('agency_id', profile.agency_id)
    .eq('location_id', locationId)

  return NextResponse.json({ ok: true })
}
