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

  if (profile?.role !== 'super_admin' && profile?.role !== 'admin') throw new Error('Not authorized')
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
      if (profile.role === 'super_admin' || profile.role === 'admin') continue
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
  const state = designSlug
    ? createOAuthState({ flow: 'admin_design_install', designSlug })
    : createOAuthState({ flow: 'connect_location' })
  const params = new URLSearchParams({ response_type: 'code', redirect_uri: redirectUri, client_id: clientId, state })
  let url = `https://marketplace.gohighlevel.com/oauth/chooselocation?${params.toString()}&scope=${encodeURIComponent(scope).replace(/%2F/g, '/')}`
  if (versionId) url += `&version_id=${versionId}`
  return { url }
}

export async function addLocation(locationId: string): Promise<{ error: string } | undefined> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('role, agency_id').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') return { error: 'Not authorized' }
  if (!profile.agency_id) return { error: 'No agency' }

  const trimmed = locationId.trim()
  if (!trimmed) return { error: 'Location ID is required' }

  // Check if already exists for this agency
  const { data: existing } = await sb.from('locations').select('location_id').eq('location_id', trimmed).eq('agency_id', profile.agency_id).maybeSingle()
  if (existing) return { error: 'This location is already in your list' }

  const { error } = await sb.from('locations').upsert(
    { location_id: trimmed, name: trimmed, agency_id: profile.agency_id },
    { onConflict: 'location_id' },
  )
  if (error) return { error: error.message }

  revalidatePath('/admin/locations')
}

export async function getConnectLocationUrl(locationId: string): Promise<{ url: string } | { error: string }> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('role, agency_id').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') return { error: 'Not authorized' }

  // Check subscription (Bibot bypasses)
  const { isBibotAgency } = await import('@/lib/isBibotAgency')
  if (!isBibotAgency(profile?.agency_id)) {
    const { data: sub } = await sb.from('agency_subscriptions').select('status').eq('agency_id', profile!.agency_id!).eq('location_id', locationId).eq('status', 'active').maybeSingle()
    if (!sub) return { error: 'Subscribe to this location before connecting GHL' }
  }

  const clientId = process.env.GHL_CLIENT_ID
  const redirectUri = process.env.GHL_REDIRECT_URI
  if (!clientId || !redirectUri) {
    return { error: 'GHL OAuth not configured (missing GHL_CLIENT_ID or GHL_REDIRECT_URI)' }
  }
  const { GHL_SCOPES } = await import('@/lib/ghl/scopes')
  const { createOAuthState } = await import('@/lib/ghl/oauthState')
  const scope = process.env.GHL_SCOPES ?? GHL_SCOPES
  const versionId = process.env.GHL_APP_VERSION_ID ?? ''
  const state = createOAuthState({ flow: 'connect_location', locationId })
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
      // Subscribing: set plan, subscribed_at, date_added if missing, clear churned_at
      upsertData.ghl_plan_id = ghlPlanId
      upsertData.subscribed_at = now
      upsertData.churned_at = null
      // Set ghl_date_added if not already set (for total paid calculation)
      const { data: loc } = await supabase.from('locations').select('ghl_date_added').eq('location_id', locationId).single()
      if (!loc?.ghl_date_added) upsertData.ghl_date_added = now
    } else {
      // Removing plan: clear plan and set churned
      upsertData.ghl_plan_id = null
      upsertData.churned_at = now
    }
    const { location_id: _, ...updateData } = upsertData as Record<string, unknown> & { location_id: string }
    const { error } = await supabase
      .from('locations')
      .update(updateData)
      .eq('location_id', locationId)
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
    const { data: existing } = await supabase.from('installs').select('id').eq('location_id', locationId).maybeSingle()
    let error
    if (existing) {
      ({ error } = await supabase.from('installs').update({ design_slug: designSlug, configured: false }).eq('location_id', locationId))
    } else {
      ({ error } = await supabase.from('installs').insert({ location_id: locationId, design_slug: designSlug, configured: false, installed_at: new Date().toISOString() }))
    }

    if (error) return { error: error.message }

    await runDesignInstaller(locationId, designSlug)

    redirect('/admin/locations')
  } catch (err) {
    if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err
    return { error: err instanceof Error ? err.message : 'Failed to install design' }
  }
}

export async function removeDesign(locationId: string): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()
    await supabase.from('installs').update({ design_slug: null, configured: false }).eq('location_id', locationId)
    redirect('/admin/locations')
  } catch (err) {
    if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err
    return { error: err instanceof Error ? err.message : 'Failed to remove design' }
  }
}
