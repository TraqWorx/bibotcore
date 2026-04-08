import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { stripe } from '@/lib/stripe/stripe'

export async function POST(req: NextRequest) {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id').eq('id', user.id).single()
  if (!profile?.agency_id) return NextResponse.json({ error: 'No agency' }, { status: 403 })

  const { data: agency } = await sb.from('agencies').select('stripe_customer_id').eq('id', profile.agency_id).single()
  if (!agency?.stripe_customer_id) return NextResponse.json({ error: 'No billing setup' }, { status: 400 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://core.bibotcrm.it'

  const session = await stripe.billingPortal.sessions.create({
    customer: agency.stripe_customer_id,
    return_url: `${appUrl}/admin/account`,
  })

  return NextResponse.json({ url: session.url })
}
