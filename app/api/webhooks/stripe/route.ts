import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/stripe'
import { createAdminClient } from '@/lib/supabase-server'
import { getPlan, DEFAULT_PLAN } from '@/lib/stripe/plans'
import type Stripe from 'stripe'

/**
 * The Stripe "basil" API (SDK v22) moved invoice.subscription to
 * invoice.parent.subscription_details.subscription. Read both so the handler
 * works regardless of the endpoint's configured API version.
 */
function invoiceSubscriptionId(invoice: Record<string, unknown>): string | null {
  const legacy = invoice.subscription
  if (typeof legacy === 'string') return legacy
  const parent = invoice.parent as { subscription_details?: { subscription?: unknown } } | undefined
  const sub = parent?.subscription_details?.subscription
  return typeof sub === 'string' ? sub : null
}

/** Period dates moved from the Subscription root to its items in basil. */
function subscriptionPeriod(sub: Record<string, unknown>): { start: string | null; end: string | null } {
  let start = typeof sub.current_period_start === 'number' ? sub.current_period_start : null
  let end = typeof sub.current_period_end === 'number' ? sub.current_period_end : null
  if (start === null || end === null) {
    const items = (sub.items as { data?: { current_period_start?: number; current_period_end?: number }[] } | undefined)?.data
    const item = items?.[0]
    if (start === null && typeof item?.current_period_start === 'number') start = item.current_period_start
    if (end === null && typeof item?.current_period_end === 'number') end = item.current_period_end
  }
  return {
    start: start !== null ? new Date(start * 1000).toISOString() : null,
    end: end !== null ? new Date(end * 1000).toISOString() : null,
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const stripe = getStripe()
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
      const resolvedPlan = getPlan(session.metadata?.plan) ?? DEFAULT_PLAN
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

      if (agencyId && locationId && subscriptionId) {
        await sb.from('agency_subscriptions').upsert({
          agency_id: agencyId,
          location_id: locationId,
          plan: resolvedPlan.id,
          status: 'active',
          stripe_subscription_id: subscriptionId,
          price_cents: resolvedPlan.priceCents,
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
      const { start: periodStart, end: periodEnd } = subscriptionPeriod(raw)
      // A pending cancellation (cancel_at_period_end) still reports status
      // 'active' here — keep it active so access continues until the period
      // actually ends and Stripe sends customer.subscription.deleted.

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
      const subscriptionId = invoiceSubscriptionId(invoice)
      if (subscriptionId) {
        await sb.from('agency_subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscriptionId)
      }
      break
    }

    case 'charge.refunded': {
      const charge = event.data.object as unknown as Record<string, unknown>
      const amountRefunded = typeof charge.amount_refunded === 'number' ? charge.amount_refunded : 0
      const invoiceId = typeof charge.invoice === 'string' ? charge.invoice : null
      if (invoiceId) {
        try {
          const invoice = await stripe.invoices.retrieve(invoiceId) as unknown as Record<string, unknown>
          const subscriptionId = invoiceSubscriptionId(invoice)
          if (subscriptionId) {
            // Only act if we actually track this subscription. charge.amount_refunded
            // is the cumulative refunded total for the charge, so store it
            // absolutely (not additively) — this makes duplicate webhook
            // deliveries idempotent instead of inflating refunded_cents.
            const { data: sub } = await sb.from('agency_subscriptions')
              .select('stripe_subscription_id')
              .eq('stripe_subscription_id', subscriptionId)
              .maybeSingle()
            if (sub) {
              await stripe.subscriptions.cancel(subscriptionId)
              await sb.from('agency_subscriptions')
                .update({ status: 'canceled', refunded_cents: amountRefunded, updated_at: new Date().toISOString() })
                .eq('stripe_subscription_id', subscriptionId)
              console.log(`[Stripe webhook] Refund $${(amountRefunded / 100).toFixed(2)} → canceled subscription ${subscriptionId}`)
            }
          }
        } catch (err) {
          console.error('[Stripe webhook] refund handling error:', err)
        }
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
