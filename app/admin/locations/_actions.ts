'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'
import { runDesignInstaller } from '@/lib/designInstaller/runDesignInstaller'
import { provisionLocation } from '@/lib/ghl/provisionLocation'
import { syncSubscriptionsCore } from '@/lib/syncSubscriptions'

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
  const { GHL_SCOPES } = await import('@/lib/ghl/scopes')
  const { createOAuthState } = await import('@/lib/ghl/oauthState')
  const scope = process.env.GHL_SCOPES ?? GHL_SCOPES
  const versionId = process.env.GHL_APP_VERSION_ID ?? ''
  const state = createOAuthState({ flow: 'admin_design_install', designSlug })
  // Build URL manually to avoid URLSearchParams encoding slashes in scope names
  const params = new URLSearchParams({ response_type: 'code', redirect_uri: redirectUri, client_id: clientId, state })
  let url = `https://marketplace.gohighlevel.com/oauth/chooselocation?${params.toString()}&scope=${encodeURIComponent(scope).replace(/%2F/g, '/')}`
  if (versionId) url += `&version_id=${versionId}`
  return { url }
}

export async function syncLocationSubscriptions(): Promise<{ synced: number; error?: string }> {
  try {
    await assertSuperAdmin()
    return await syncSubscriptionsCore()
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
      updated_at: now,
    }
    if (ghlPlanId) {
      // Subscribing: set plan, subscribed_at, clear churned_at
      upsertData.ghl_plan_id = ghlPlanId
      upsertData.subscribed_at = now
      upsertData.churned_at = null
    } else {
      // Removing plan: set churned_at but keep ghl_plan_id for revenue tracking
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
