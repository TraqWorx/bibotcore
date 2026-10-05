import { cached } from '@/lib/cache/appCache'

export interface ChargeLite {
  amount: number
  created: number
}

/**
 * Every succeeded charge since the start of last year, from the GHL-connected
 * Stripe account, for the quarterly VAT figures.
 *
 * This walks Stripe 100 charges at a time and the page used to do it on every
 * single view — about ten seconds before anything rendered. Last year's charges
 * do not change, so the whole list is cached for fifteen minutes.
 */
async function fetchCharges(fromYear: number): Promise<ChargeLite[]> {
  const key = process.env.STRIPE_GHL_SECRET_KEY
  if (!key) return []
  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(key)
  const oldestStart = Math.floor(new Date(fromYear, 0, 1).getTime() / 1000)

  const out: ChargeLite[] = []
  let startingAfter: string | undefined
  for (;;) {
    const page = await stripe.charges.list({
      created: { gte: oldestStart },
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    for (const c of page.data) {
      // amount > 500 excludes the test charges this account carries
      if (c.status === 'succeeded' && c.amount > 500) out.push({ amount: c.amount, created: c.created })
    }
    if (!page.has_more || page.data.length === 0) break
    startingAfter = page.data[page.data.length - 1].id
  }
  return out
}

export async function getStripeChargesForVat(fromYear: number): Promise<ChargeLite[]> {
  try {
    return await cached(`stripe-charges-for-vat:${fromYear}`, 900, () => fetchCharges(fromYear))
  } catch {
    // A Stripe outage with nothing cached yet should still render the page.
    return []
  }
}
