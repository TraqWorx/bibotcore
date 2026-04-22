import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import Stripe from 'stripe'

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    // Use GHL Stripe for customer payment history (separate from SaaS Stripe)
    const ghlStripeKey = process.env.STRIPE_GHL_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY
    if (!ghlStripeKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    const stripe = new Stripe(ghlStripeKey)

    // Find Stripe customers linked to this location
    const allCustomers: { id: string; email: string | null; metadata: Record<string, string> }[] = []
    let hasMore = true
    let startingAfter: string | undefined
    while (hasMore) {
      const page = await stripe.customers.list({ limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) })
      for (const c of page.data) allCustomers.push({ id: c.id, email: c.email, metadata: (c.metadata ?? {}) as Record<string, string> })
      hasMore = page.has_more
      if (page.data.length > 0) startingAfter = page.data[page.data.length - 1].id
    }

    const locationCustomerIds: string[] = []
    for (const c of allCustomers) {
      const locId = c.metadata?.locationId ?? c.metadata?.location
      if (locId === locationId) locationCustomerIds.push(c.id)
    }

    // Match by emails unique to this location (exclude shared team members)
    const { data: profiles } = await sb.from('profiles').select('email, location_id').eq('location_id', locationId)
    const candidateEmails = (profiles ?? []).map(p => p.email?.toLowerCase()).filter(Boolean) as string[]

    // Exclude emails that appear in other locations too
    const locationEmails = new Set<string>()
    for (const email of candidateEmails) {
      const { count } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('email', email)
      const { count: locCount } = await sb.from('profile_locations').select('user_id', { count: 'exact', head: true })
        .in('user_id', (await sb.from('profiles').select('id').eq('email', email)).data?.map(p => p.id) ?? [])
      // Only include if this email isn't shared across multiple locations
      if ((count ?? 0) <= 1 && (locCount ?? 0) <= 1) {
        locationEmails.add(email)
      }
    }
    for (const c of allCustomers) {
      if (c.email && locationEmails.has(c.email.toLowerCase()) && !locationCustomerIds.includes(c.id)) {
        locationCustomerIds.push(c.id)
      }
    }

    if (locationCustomerIds.length === 0) {
      return NextResponse.json({ payments: [] })
    }

    // Get all charges for these customers (charges have fee data)
    const payments: {
      id: string
      date: string
      amount: number
      stripeFee: number
      net: number
      status: string
      customerEmail: string
      receiptUrl: string | null
    }[] = []

    const customerEmailMap = new Map<string, string>()
    for (const c of allCustomers) {
      if (locationCustomerIds.includes(c.id) && c.email) customerEmailMap.set(c.id, c.email)
    }

    for (const custId of locationCustomerIds) {
      const charges = await stripe.charges.list({
        customer: custId,
        limit: 100,
        expand: ['data.balance_transaction'],
      })

      for (const charge of charges.data) {
        if (charge.status !== 'succeeded') continue
        let stripeFee = 0
        let net = charge.amount
        const bt = charge.balance_transaction
        if (bt && typeof bt === 'object') {
          const btObj = bt as unknown as { fee: number; net: number }
          stripeFee = btObj.fee
          net = btObj.net
        }
        payments.push({
          id: charge.id,
          date: new Date(charge.created * 1000).toISOString(),
          amount: charge.amount,
          stripeFee,
          net,
          status: charge.status,
          customerEmail: customerEmailMap.get(custId) ?? charge.billing_details?.email ?? '',
          receiptUrl: charge.receipt_url ?? null,
        })
      }
    }

    payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({ payments })
  } catch (err) {
    console.error('[admin/billing]', err)
    return NextResponse.json({ error: 'Failed to fetch billing data' }, { status: 500 })
  }
}
