import { cached } from '@/lib/cache/appCache'
import { createAdminClient } from '@/lib/supabase-server'

export interface AffiliateCost {
  monthlyCost: number
  totalOwed: number
}

/**
 * What the agency's affiliates cost per month, and what they are owed.
 *
 * This is several GHL calls per connected location — affiliates, then a
 * campaign and a customer list per affiliate — with a database lookup per
 * customer on top. The Finances page used to do all of it inline on every
 * view. Affiliate commissions move slowly, so the result is cached for fifteen
 * minutes.
 */
async function computeAffiliateCost(agencyId: string): Promise<AffiliateCost> {
  const sb = createAdminClient()
  const { refreshIfNeeded } = await import('@/lib/ghl/refreshIfNeeded')
  let monthlyCost = 0
  let totalOwed = 0

  const { data: agencyLocs } = await sb.from('locations').select('location_id').eq('agency_id', agencyId)
  const { data: conns } = await sb
    .from('ghl_connections')
    .select('location_id, access_token, refresh_token, expires_at, company_id')
    .in('location_id', (agencyLocs ?? []).map((l) => l.location_id))
    .not('refresh_token', 'is', null)

  // Plan prices, read once instead of once per affiliate customer.
  const { data: plans } = await sb.from('ghl_plans').select('ghl_plan_id, name, price_monthly')
  const priceByPlanId = new Map<string, number>()
  const priceByPlanName = new Map<string, number>()
  for (const p of (plans ?? []) as Array<{ ghl_plan_id: string; name: string | null; price_monthly: number | null }>) {
    if (p.price_monthly == null) continue
    priceByPlanId.set(p.ghl_plan_id, Number(p.price_monthly))
    if (p.name) priceByPlanName.set(p.name, Number(p.price_monthly))
  }

  for (const conn of conns ?? []) {
    // The refreshed token is already location-scoped; exchanging it again via
    // /oauth/locationToken only works for company tokens and silently failed here.
    const affToken = await refreshIfNeeded(conn.location_id, conn)
    if (!affToken) continue
    const headers = { Authorization: `Bearer ${affToken}`, Version: '2021-07-28' }

    const affRes = await fetch(`https://services.leadconnectorhq.com/affiliate-manager/${conn.location_id}/affiliates`, { headers })
    if (!affRes.ok) continue
    const affData = await affRes.json()
    const affiliates = (affData.affiliates ?? []) as Array<{ _id?: string; owned?: number; campaignIds?: string[] }>

    for (const a of affiliates) {
      totalOwed += a.owned ?? 0

      let commRate = 0
      if (a.campaignIds?.[0]) {
        const campRes = await fetch(`https://services.leadconnectorhq.com/affiliate-manager/${conn.location_id}/campaigns/${a.campaignIds[0]}`, { headers })
        if (campRes.ok) {
          const camp = await campRes.json()
          commRate = (camp.commissionV2?.[0]?.defaultCommission?.commission ?? 0) / 100
        }
      }
      if (commRate <= 0 || !a._id) continue

      const custRes = await fetch(`https://services.leadconnectorhq.com/affiliate-manager/${conn.location_id}/affiliates/${a._id}/customers`, { headers })
      if (!custRes.ok) continue
      const custData = await custRes.json()
      const customers = (custData.customers ?? []) as Array<{ type?: string; email?: string; planName?: string }>

      // Resolve all the customer emails to locations in two queries rather than
      // three per customer.
      const emails = customers
        .filter((c) => c.type !== 'dropped' && c.email)
        .map((c) => (c.email as string).toLowerCase())
      const planIdByEmail = new Map<string, string>()
      if (emails.length > 0) {
        const { data: profs } = await sb.from('profiles').select('email, location_id').in('email', emails)
        const locIds = (profs ?? []).map((p) => p.location_id).filter((x): x is string => !!x)
        const planByLoc = new Map<string, string>()
        if (locIds.length > 0) {
          const { data: locs } = await sb.from('locations').select('location_id, ghl_plan_id').in('location_id', locIds)
          for (const l of (locs ?? []) as Array<{ location_id: string; ghl_plan_id: string | null }>) {
            if (l.ghl_plan_id) planByLoc.set(l.location_id, l.ghl_plan_id)
          }
        }
        for (const p of (profs ?? []) as Array<{ email: string | null; location_id: string | null }>) {
          const planId = p.location_id ? planByLoc.get(p.location_id) : undefined
          if (p.email && planId) planIdByEmail.set(p.email.toLowerCase(), planId)
        }
      }

      for (const c of customers) {
        // Dropped customers no longer pay, so they earn no commission
        if (c.type === 'dropped') continue
        const email = c.email?.toLowerCase()
        const planId = email ? planIdByEmail.get(email) : undefined
        let price = planId ? priceByPlanId.get(planId) ?? null : null
        // No profile for this customer yet: fall back to the plan name GHL reports
        if (price == null && c.planName) price = priceByPlanName.get(c.planName) ?? null
        if (price != null) monthlyCost += price * commRate
      }
    }
  }

  return { monthlyCost, totalOwed }
}

export async function getAffiliateCost(agencyId: string): Promise<AffiliateCost> {
  try {
    return await cached(`affiliate-cost:${agencyId}`, 900, () => computeAffiliateCost(agencyId))
  } catch {
    return { monthlyCost: 0, totalOwed: 0 }
  }
}
