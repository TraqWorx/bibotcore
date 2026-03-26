'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'
import { runDesignInstaller } from '@/lib/designInstaller/runDesignInstaller'
import { provisionLocation } from '@/lib/ghl/provisionLocation'
import { fetchGhlPlans } from '@/lib/ghl/getGhlPlans'

async function assertSuperAdmin() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') throw new Error('Not authorized')
}

export async function connectLocations(
  locationIds: string[],
  designSlug: string
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()

    if (!locationIds.length) return { error: 'Select at least one location' }
    if (!designSlug) return { error: 'Select a design' }

    if (!process.env.GHL_AGENCY_TOKEN || !process.env.GHL_COMPANY_ID) {
      return { error: 'Agency token not configured' }
    }

    for (const locationId of locationIds) {
      await provisionLocation(locationId, designSlug)
      runDesignInstaller(locationId, designSlug).catch((err) =>
        console.error(`[connectLocations] installer failed for ${locationId}:`, err)
      )
    }

    revalidatePath('/admin/locations')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to connect locations' }
  }
}

export async function disconnectLocation(
  locationId: string
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()

    // Delete all client users linked to this location
    const { data: linkedProfiles } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('location_id', locationId)

    for (const profile of linkedProfiles ?? []) {
      if (profile.role !== 'client') continue
      const { error: deleteErr } = await supabase.auth.admin.deleteUser(profile.id)
      if (deleteErr) {
        console.error('[disconnectLocation] deleteUser failed:', profile.email, deleteErr.message)
      } else {
        console.log('[disconnectLocation] deleted user:', profile.email)
      }
    }

    await Promise.all([
      supabase.from('ghl_connections').delete().eq('location_id', locationId),
      supabase.from('installs').delete().eq('location_id', locationId),
      supabase.from('locations').delete().eq('location_id', locationId),
    ])
    revalidatePath('/admin/locations')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to disconnect location' }
  }
}

export async function getGhlOAuthUrl(
  designSlug: string
): Promise<{ url: string } | { error: string }> {
  await assertSuperAdmin()
  const clientId = process.env.GHL_CLIENT_ID
  const redirectUri = process.env.GHL_REDIRECT_URI
  if (!clientId || !redirectUri) {
    return { error: 'GHL OAuth not configured (missing GHL_CLIENT_ID or GHL_REDIRECT_URI)' }
  }
  const scope = process.env.GHL_SCOPES ??
    'contacts.readonly contacts.write opportunities.readonly opportunities.write ' +
    'calendars.readonly calendars.write calendars/events.readonly calendars/events.write ' +
    'calendars/groups.readonly calendars/groups.write ' +
    'conversations.readonly conversations.write conversations/message.readonly conversations/message.write ' +
    'locations.readonly locations.write locations/customFields.readonly locations/customFields.write ' +
    'locations/customValues.readonly locations/customValues.write ' +
    'locations/tags.readonly locations/tags.write ' +
    'users.readonly forms.readonly forms.write medias.readonly medias.write products.readonly products.write'
  const versionId = process.env.GHL_APP_VERSION_ID ?? ''
  const state = `${designSlug}|admin`
  // Build URL manually to avoid URLSearchParams encoding slashes in scope names
  const params = new URLSearchParams({ response_type: 'code', redirect_uri: redirectUri, client_id: clientId, state })
  let url = `https://marketplace.gohighlevel.com/oauth/chooselocation?${params.toString()}&scope=${encodeURIComponent(scope).replace(/%2F/g, '/')}`
  if (versionId) url += `&version_id=${versionId}`
  return { url }
}

const GHL_BASE = 'https://services.leadconnectorhq.com'

export async function syncLocationSubscriptions(): Promise<{ synced: number; error?: string }> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()
    const token = process.env.GHL_AGENCY_TOKEN
    const companyId = process.env.GHL_COMPANY_ID
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
          const saasPlanId: string | null = loc?.settings?.saasSettings?.saasPlanId ?? null
          const name: string = loc?.name ?? ''
          const dateAdded: string | null =
            loc?.dateAdded ?? loc?.date_added ?? loc?.createdAt ?? loc?.created_at ?? null
          return { id, name, saasPlanId, dateAdded }
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
        .select('ghl_plan_id, subscribed_at')
        .eq('location_id', detail.id)
        .maybeSingle()

      if (detail.saasPlanId) {
        const updates: Record<string, unknown> = { ...base, ghl_plan_id: detail.saasPlanId }
        if (!existing?.subscribed_at) {
          updates.subscribed_at = new Date().toISOString()
        }
        updates.churned_at = null
        const { error } = await supabase
          .from('locations')
          .upsert(updates, { onConflict: 'location_id' })
        if (!error) synced++
      } else {
        const updates: Record<string, unknown> = { ...base, ghl_plan_id: null }
        // If had a plan before, mark as churned
        if (existing?.ghl_plan_id) {
          updates.churned_at = new Date().toISOString()
        }
        await supabase.from('locations').upsert(updates, { onConflict: 'location_id' })
      }
    }
    revalidatePath('/admin/locations')
    revalidatePath('/admin/plan-mapping')
    return { synced }
  } catch (err) {
    return { synced: 0, error: err instanceof Error ? err.message : 'Failed to sync' }
  }
}

export async function setLocationPlan(
  locationId: string,
  ghlPlanId: string | null
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()
    const now = new Date().toISOString()
    const upsertData: Record<string, unknown> = {
      location_id: locationId,
      ghl_plan_id: ghlPlanId,
      updated_at: now,
    }
    if (ghlPlanId) {
      // Subscribing: set subscribed_at, clear churned_at
      upsertData.subscribed_at = now
      upsertData.churned_at = null
    } else {
      // Removing plan: set churned_at (only if was previously subscribed)
      upsertData.churned_at = now
    }
    const { error } = await supabase
      .from('locations')
      .upsert(upsertData, { onConflict: 'location_id' })
    if (error) return { error: error.message }
    revalidatePath('/admin/locations')
    revalidatePath('/admin')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update plan' }
  }
}

export async function installDesign(
  locationId: string,
  designSlug: string
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()

    const supabase = createAdminClient()

    // Set design_slug and reset configured so installer runs fresh
    const { error } = await supabase
      .from('installs')
      .update({ design_slug: designSlug, configured: false })
      .eq('location_id', locationId)

    if (error) return { error: error.message }

    await runDesignInstaller(locationId, designSlug)

    redirect('/admin/locations')
  } catch (err) {
    if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err
    return { error: err instanceof Error ? err.message : 'Failed to install design' }
  }
}
