import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/stripe'
import { createAdminClient } from '@/lib/supabase-server'
import { PLANS } from '@/lib/stripe/plans'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[Stripe webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const sb = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const agencyId = session.metadata?.agency_id
      const locationId = session.metadata?.location_id
      const plan = session.metadata?.plan as keyof typeof PLANS | undefined
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

      if (agencyId && locationId && plan && subscriptionId) {
        await sb.from('agency_subscriptions').upsert({
          agency_id: agencyId,
          location_id: locationId,
          plan,
          status: 'active',
          stripe_subscription_id: subscriptionId,
          price_cents: PLANS[plan]?.priceCents ?? 1000,
          current_period_start: new Date().toISOString(),
        }, { onConflict: 'agency_id,location_id' })

        // Create default dashboard config if none exists
        const { data: existing } = await sb.from('dashboard_configs').select('id').eq('location_id', locationId).maybeSingle()
        if (!existing) {
          await sb.from('dashboard_configs').insert({
            location_id: locationId,
            agency_id: agencyId,
            config: [],
          })
        }
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const status = subscription.status === 'active' ? 'active'
        : subscription.status === 'past_due' ? 'past_due'
        : subscription.status === 'canceled' ? 'canceled'
        : subscription.status === 'trialing' ? 'trialing'
        : 'canceled'

      const raw = subscription as unknown as Record<string, unknown>
      const periodStart = typeof raw.current_period_start === 'number' ? new Date(raw.current_period_start * 1000).toISOString() : null
      const periodEnd = typeof raw.current_period_end === 'number' ? new Date(raw.current_period_end * 1000).toISOString() : null

      await sb.from('agency_subscriptions')
        .update({
          status,
          ...(periodStart && { current_period_start: periodStart }),
          ...(periodEnd && { current_period_end: periodEnd }),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await sb.from('agency_subscriptions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subscription.id)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as unknown as Record<string, unknown>
      const rawSub = invoice.subscription
      const subscriptionId = typeof rawSub === 'string' ? rawSub : null
      if (subscriptionId) {
        await sb.from('agency_subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscriptionId)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
