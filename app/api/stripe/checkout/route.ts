import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { stripe } from '@/lib/stripe/stripe'
import { PLAN } from '@/lib/stripe/plans'

export async function POST(req: NextRequest) {
  const { locationId } = await req.json() as { locationId: string }

  if (!locationId) {
    return NextResponse.json({ error: 'locationId required' }, { status: 400 })
  }

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id').eq('id', user.id).single()
  if (!profile?.agency_id) return NextResponse.json({ error: 'No agency' }, { status: 403 })

  const { data: agency } = await sb.from('agencies').select('stripe_customer_id, email, name').eq('id', profile.agency_id).single()
  if (!agency) return NextResponse.json({ error: 'Agency not found' }, { status: 404 })

  // Get or create Stripe customer
  let customerId = agency.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: agency.email,
      name: agency.name,
      metadata: { agency_id: profile.agency_id },
    })
    customerId = customer.id
    await sb.from('agencies').update({ stripe_customer_id: customerId }).eq('id', profile.agency_id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://core.bibotcrm.it'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: PLAN.priceId, quantity: 1 }],
    success_url: `${appUrl}/admin/locations/${locationId}?subscribed=true`,
    cancel_url: `${appUrl}/admin/locations`,
    metadata: {
      agency_id: profile.agency_id,
      location_id: locationId,
      plan: PLAN.id,
    },
    subscription_data: {
      metadata: {
        agency_id: profile.agency_id,
        location_id: locationId,
        plan: PLAN.id,
      },
    },
  })

  return NextResponse.json({ url: session.url })
}
