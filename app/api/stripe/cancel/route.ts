import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe/stripe'

export async function POST(req: NextRequest) {
  const { locationId } = await req.json() as { locationId: string }
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id').eq('id', user.id).single()
  if (!profile?.agency_id) return NextResponse.json({ error: 'No agency' }, { status: 403 })

  // Find the subscription
  const { data: sub } = await sb
    .from('agency_subscriptions')
    .select('stripe_subscription_id, status')
    .eq('agency_id', profile.agency_id)
    .eq('location_id', locationId)
    .eq('status', 'active')
    .single()

  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
  }

  try {
    // Cancel at period end (they keep access until the billing period ends)
    const stripe = getStripe()
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    // Update status in DB
    await sb.from('agency_subscriptions')
      .update({ status: 'canceled' })
      .eq('agency_id', profile.agency_id)
      .eq('location_id', locationId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[stripe/cancel]', err)
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
