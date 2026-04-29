import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

let _stripeGhl: Stripe | null = null
function getStripeGhl(): Stripe {
  if (!_stripeGhl) {
    const key = process.env.STRIPE_GHL_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('No Stripe key configured')
    _stripeGhl = new Stripe(key)
  }
  return _stripeGhl
}

interface ChargeRow {
  charge_id: string
  customer_id: string | null
  email: string | null
  location_id: string | null
  amount_cents: number
  fee_cents: number | null
  net_cents: number | null
  currency: string | null
  status: string
  receipt_url: string | null
  refunded_cents: number
  created_at: string
  updated_at: string
}

async function chargeRow(stripe: Stripe, charge: Stripe.Charge): Promise<ChargeRow> {
  let fee: number | null = null
  let net: number | null = null
  if (charge.balance_transaction) {
    const bt = typeof charge.balance_transaction === 'string'
      ? await stripe.balanceTransactions.retrieve(charge.balance_transaction)
      : charge.balance_transaction
    fee = bt.fee
    net = bt.net
  }
  const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id ?? null
  let email = charge.billing_details?.email ?? null
  let locationId: string | null = null
  if (customerId) {
    try {
      const cust = await stripe.customers.retrieve(customerId)
      if (!cust.deleted) {
        email = email ?? cust.email
        const meta = (cust.metadata ?? {}) as Record<string, string>
        locationId = meta.locationId ?? meta.location ?? null
      }
    } catch { /* ignore */ }
  }
  return {
    charge_id: charge.id,
    customer_id: customerId,
    email,
    location_id: locationId,
    amount_cents: charge.amount,
    fee_cents: fee,
    net_cents: net,
    currency: charge.currency ?? null,
    status: charge.status ?? 'unknown',
    receipt_url: charge.receipt_url ?? null,
    refunded_cents: charge.amount_refunded ?? 0,
    created_at: new Date(charge.created * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_GHL_WEBHOOK_SECRET
  if (!sig || !secret) return NextResponse.json({ error: 'Missing signature/secret' }, { status: 400 })

  const stripe = getStripeGhl()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    console.error('[stripe-ghl webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const sb = createAdminClient()

  switch (event.type) {
    case 'charge.succeeded':
    case 'charge.updated':
    case 'charge.refunded':
    case 'charge.failed': {
      const charge = event.data.object as Stripe.Charge
      const row = await chargeRow(stripe, charge)
      const { error } = await sb.from('stripe_ghl_charges').upsert(row, { onConflict: 'charge_id' })
      if (error) console.error('[stripe-ghl webhook] upsert failed:', error.message)
      break
    }
    default:
      // Ignore other event types — handler is intentionally narrow.
      break
  }

  return NextResponse.json({ received: true })
}
