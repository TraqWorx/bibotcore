import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe/stripe'
import { getPlan } from '@/lib/stripe/plans'

/**
 * Switch an active location subscription between plans (Launch <-> Growth).
 * Updates the live Stripe subscription in place with proration — an upgrade
 * invoices the prorated difference immediately, a downgrade credits it against
 * the next invoice. No cancel-and-wait.
 */
export async function POST(req: NextRequest) {
  const { locationId, plan: planId } = await req.json() as { locationId?: string; plan?: string }
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const targetPlan = getPlan(planId)
  if (!targetPlan) return NextResponse.json({ error: 'Unknown plan' }, { status: 400 })
  if (!targetPlan.priceId) return NextResponse.json({ error: 'Selected plan is not configured' }, { status: 500 })

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  if (!profile?.agency_id) return NextResponse.json({ error: 'No agency' }, { status: 403 })
  if (profile.role !== 'admin' && profile.role !== 'super_admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: sub } = await sb
    .from('agency_subscriptions')
    .select('stripe_subscription_id, plan, status')
    .eq('agency_id', profile.agency_id)
    .eq('location_id', locationId)
    .eq('status', 'active')
    .maybeSingle()

  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No paid subscription found for this location' }, { status: 404 })
  }
  if (sub.plan === targetPlan.id) {
    return NextResponse.json({ error: `Already on ${targetPlan.name}` }, { status: 409 })
  }

  try {
    const stripe = getStripe()
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
    const item = stripeSub.items.data[0]
    if (!item) return NextResponse.json({ error: 'Subscription has no items in Stripe' }, { status: 500 })

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: item.id, price: targetPlan.priceId }],
      proration_behavior: 'always_invoice',
      payment_behavior: 'error_if_incomplete', // reject atomically if the prorated charge fails
      metadata: { ...stripeSub.metadata, plan: targetPlan.id },
    })

    await sb.from('agency_subscriptions')
      .update({ plan: targetPlan.id, price_cents: targetPlan.priceCents, updated_at: new Date().toISOString() })
      .eq('agency_id', profile.agency_id)
      .eq('location_id', locationId)

    return NextResponse.json({ ok: true, plan: targetPlan.id })
  } catch (err) {
    console.error('[stripe/change-plan]', err)
    const msg = err instanceof Error ? err.message : 'Plan change failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
