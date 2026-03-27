import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-server'
import { fetchGhlPlans } from '@/lib/ghl/getGhlPlans'
import { syncLocationUsers } from '@/lib/ghl/provisionLocation'

const GHL_BASE = 'https://services.leadconnectorhq.com'

export async function syncSubscriptionsCore(): Promise<{ synced: number; error?: string }> {
  const supabase = createAdminClient()
  const token = process.env.GHL_AGENCY_TOKEN
  const companyId = process.env.GHL_COMPANY_ID
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!token) return { synced: 0, error: 'GHL_AGENCY_TOKEN not set' }

  // Step 1: Sync plan prices from GHL into ghl_plans table
  const { plans } = await fetchGhlPlans(token, companyId)
  for (const plan of plans) {
    const row: Record<string, unknown> = { ghl_plan_id: plan.id, name: plan.name }
    if (plan.priceMonthly != null) row.price_monthly = plan.priceMonthly
    await supabase.from('ghl_plans').upsert(row, { onConflict: 'ghl_plan_id' })
  }

  // Step 2: Fetch all GHL locations (search gives us IDs)
  const searchRes = await fetch(
    `${GHL_BASE}/locations/search?limit=100${companyId ? `&companyId=${companyId}` : ''}`,
    { headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' }, cache: 'no-store' }
  )
  const searchData = searchRes.ok ? await searchRes.json() : null
  const locationIds: string[] = (searchData?.locations ?? []).map((l: { id: string }) => l.id).filter(Boolean)

  if (locationIds.length === 0) {
    revalidatePath('/admin/locations')
    return { synced: 0, error: 'No locations found in GHL' }
  }

  // Step 3: Fetch each location individually (search strips saasSettings — individual GET has it)
  const details = await Promise.all(
    locationIds.map(async (id) => {
      try {
        const res = await fetch(`${GHL_BASE}/locations/${id}`, {
          headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
          cache: 'no-store',
        })
        if (!res.ok) {
          console.warn(`[syncSubs] GET /locations/${id} status=${res.status}`)
          return null
        }
        const data = await res.json()
        const loc = data?.location ?? data
        const saasSettings = loc?.settings?.saasSettings
        const saasPlanId: string | null = saasSettings?.saasPlanId ?? null
        const subscriptionId: string | null = saasSettings?.planDetails?.subscriptionId ?? null
        const subscriptionStatus: string | null = saasSettings?.planDetails?.subscriptionStatus ?? null
        const isActive = subscriptionStatus !== 'canceled' && subscriptionStatus !== 'cancelled'
        const name: string = loc?.name ?? ''
        const dateAdded: string | null =
          loc?.dateAdded ?? loc?.date_added ?? loc?.createdAt ?? loc?.created_at ?? null

        // For canceled subs, fetch actual cancellation date from Stripe
        let stripeCanceledAt: string | null = null
        if (!isActive && subscriptionId && stripeKey) {
          try {
            const stripeRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
              headers: { Authorization: `Bearer ${stripeKey}` },
              cache: 'no-store',
            })
            if (stripeRes.ok) {
              const sub = await stripeRes.json()
              if (sub.canceled_at) {
                stripeCanceledAt = new Date(sub.canceled_at * 1000).toISOString()
              }
            }
          } catch {
            // Stripe lookup failed, will fall back to now()
          }
        }

        return { id, name, saasPlanId: isActive ? saasPlanId : null, lastPlanId: saasPlanId, dateAdded, canceled: !isActive, stripeCanceledAt }
      } catch {
        return null
      }
    })
  )

  // Step 4: Upsert into locations table with ghl_plan_id
  let synced = 0
  for (const detail of details) {
    if (!detail) continue
    const base: Record<string, unknown> = {
      location_id: detail.id,
      name: detail.name,
      ...(detail.dateAdded ? { ghl_date_added: detail.dateAdded } : {}),
    }
    // Check current state to detect subscription changes
    const { data: existing } = await supabase
      .from('locations')
      .select('ghl_plan_id, subscribed_at, churned_at')
      .eq('location_id', detail.id)
      .maybeSingle()

    if (detail.saasPlanId) {
      // Active subscription
      const updates: Record<string, unknown> = { ...base, ghl_plan_id: detail.saasPlanId }
      if (!existing?.subscribed_at) {
        updates.subscribed_at = detail.dateAdded ?? new Date().toISOString()
      }
      updates.churned_at = null
      const { error } = await supabase
        .from('locations')
        .upsert(updates, { onConflict: 'location_id' })
      if (!error) synced++
    } else if (detail.canceled && detail.lastPlanId) {
      // Canceled subscription — keep plan ID for revenue, mark as churned
      const updates: Record<string, unknown> = { ...base, ghl_plan_id: detail.lastPlanId }
      if (!existing?.subscribed_at) {
        updates.subscribed_at = detail.dateAdded ?? new Date().toISOString()
      }
      if (!existing?.churned_at) {
        // Use Stripe canceled_at if available, otherwise fall back to now()
        updates.churned_at = detail.stripeCanceledAt ?? new Date().toISOString()
      }
      await supabase.from('locations').upsert(updates, { onConflict: 'location_id' })
    } else {
      // No plan at all
      await supabase.from('locations').upsert(base, { onConflict: 'location_id' })
    }
  }
  // Step 5: Sync GHL users for each location → auto-create profiles for new team members
  let usersLinked = 0
  for (const detail of details) {
    if (!detail) continue
    try {
      await syncLocationUsers(detail.id, companyId!, token, supabase)
      usersLinked++
    } catch (err) {
      console.warn(`[syncSubs] user sync failed for ${detail.id}:`, err)
    }
  }

  revalidatePath('/admin/locations')
  revalidatePath('/admin/plan-mapping')
  console.log(`[syncSubs] done: ${synced} locations synced, ${plans.length} plans, ${usersLinked} locations user-synced`)
  return { synced }
}
