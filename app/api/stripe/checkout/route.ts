import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { stripe } from '@/lib/stripe/stripe'
import { getPlan, DEFAULT_PLAN, type Plan } from '@/lib/stripe/plans'

export async function POST(req: NextRequest) {
  const { locationId, plan: planId, confirm } = await req.json() as {
    locationId: string
    plan?: string
    confirm?: boolean
  }

  if (!locationId) {
    return NextResponse.json({ error: 'locationId required' }, { status: 400 })
  }

  const plan = getPlan(planId) ?? DEFAULT_PLAN
  if (!plan.priceId) {
    return NextResponse.json({ error: 'Selected plan is not configured' }, { status: 500 })
  }

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  if (!profile?.agency_id) return NextResponse.json({ error: 'No agency' }, { status: 403 })
  const agencyId = profile.agency_id

  // Ownership: only subscribe to a location in the caller's agency (super_admin bypasses).
  if (profile.role !== 'super_admin') {
    const { data: loc } = await sb.from('locations').select('agency_id').eq('location_id', locationId).maybeSingle()
    if (!loc || loc.agency_id !== agencyId) {
      return NextResponse.json({ error: 'Location not in your agency' }, { status: 403 })
    }
  }

  // Guard against a double-charge: never start a second subscription for a
  // location whose current one is still live in Stripe. past_due counts — its
  // card retries can later succeed, and a second sub would double-bill while
  // the old one's webhooks no longer match any row.
  const { data: existingSub } = await sb
    .from('agency_subscriptions')
    .select('status')
    .eq('agency_id', agencyId)
    .eq('location_id', locationId)
    .maybeSingle()
  if (existingSub?.status === 'active' || existingSub?.status === 'trialing') {
    return NextResponse.json({ error: 'This location already has an active subscription' }, { status: 409 })
  }
  if (existingSub?.status === 'past_due') {
    return NextResponse.json({ error: 'This location has a past-due subscription — update the payment method in the billing portal instead of resubscribing' }, { status: 409 })
  }

  const { data: agency } = await sb.from('agencies').select('stripe_customer_id, email, name').eq('id', agencyId).single()
  if (!agency) return NextResponse.json({ error: 'Agency not found' }, { status: 404 })

  // Get or create the agency's single Stripe customer
  let customerId = agency.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: agency.email,
      name: agency.name,
      metadata: { agency_id: agencyId },
    })
    customerId = customer.id
    await sb.from('agencies').update({ stripe_customer_id: customerId }).eq('id', agencyId)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ghlcustomdash.com'

  // Hosted Checkout — used the first time (no saved card) and as the fallback
  // when a silent charge needs authentication (SCA) or the card is declined.
  async function hostedCheckout() {
    const session = await stripe.checkout.sessions.create({
      customer: customerId!,
      mode: 'subscription',
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${appUrl}/admin/locations/${locationId}?subscribed=true`,
      cancel_url: `${appUrl}/admin/locations`,
      metadata: { agency_id: agencyId, location_id: locationId, plan: plan.id },
      subscription_data: {
        metadata: { agency_id: agencyId, location_id: locationId, plan: plan.id },
      },
    })
    return NextResponse.json({ mode: 'checkout', url: session.url })
  }

  // Does the customer already have a card on file?
  const cards = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 3 })
  const savedCard = cards.data[0]

  // First-ever subscription for this agency → collect a card via hosted Checkout.
  if (!savedCard) {
    return hostedCheckout()
  }

  // Saved card exists but the client hasn't confirmed the charge yet → return the
  // card details so it can show a one-line "charge your saved card?" confirmation.
  if (confirm !== true) {
    return NextResponse.json({
      mode: 'saved_card',
      plan: plan.id,
      planName: plan.name,
      amountLabel: plan.priceLabel,
      brand: savedCard.card?.brand ?? 'card',
      last4: savedCard.card?.last4 ?? '••••',
    })
  }

  // Confirmed → charge the saved card immediately via the Subscriptions API.
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: plan.priceId }],
      default_payment_method: savedCard.id,
      payment_behavior: 'error_if_incomplete', // fail atomically if it can't pay now
      metadata: { agency_id: agencyId, location_id: locationId, plan: plan.id },
    }, {
      // Dedupe concurrent confirms (double-click / second tab) within a minute
      // without blocking a genuine retry after a decline.
      idempotencyKey: `sub-${agencyId}-${locationId}-${plan.id}-${Math.floor(Date.now() / 60000)}`,
    })

    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      // Couldn't charge cleanly — hand off to hosted Checkout to sort payment out.
      return hostedCheckout()
    }

    await writeActiveSubscription(sb, { agencyId, locationId, plan, subscription })
    return NextResponse.json({ subscribed: true })
  } catch (err) {
    // Declined, expired, or SCA required — Stripe Checkout can handle the
    // authentication/card update that an off-page charge can't.
    console.error('[stripe/checkout] silent charge failed, falling back to Checkout:', err instanceof Error ? err.message : err)
    return hostedCheckout()
  }
}

type AdminClient = ReturnType<typeof createAdminClient>

async function writeActiveSubscription(
  sb: AdminClient,
  { agencyId, locationId, plan, subscription }: {
    agencyId: string
    locationId: string
    plan: Plan
    subscription: { id: string; items?: { data?: { current_period_start?: number; current_period_end?: number }[] } }
  },
) {
  const item = subscription.items?.data?.[0]
  const periodStart = typeof item?.current_period_start === 'number'
    ? new Date(item.current_period_start * 1000).toISOString()
    : new Date().toISOString()
  const periodEnd = typeof item?.current_period_end === 'number'
    ? new Date(item.current_period_end * 1000).toISOString()
    : null

  await sb.from('agency_subscriptions').upsert({
    agency_id: agencyId,
    location_id: locationId,
    plan: plan.id,
    status: 'active',
    stripe_subscription_id: subscription.id,
    price_cents: plan.priceCents,
    current_period_start: periodStart,
    ...(periodEnd && { current_period_end: periodEnd }),
  }, { onConflict: 'agency_id,location_id' })

  const { data: existing } = await sb.from('dashboard_configs').select('id').eq('location_id', locationId).maybeSingle()
  if (!existing) {
    await sb.from('dashboard_configs').insert({ location_id: locationId, agency_id: agencyId, config: [] })
  }
}
