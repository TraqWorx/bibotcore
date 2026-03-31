'use server'

import { redirect } from 'next/navigation'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

/**
 * Resolves the active locationId for server pages.
 *
 * 1. If searchParams.locationId is provided → validate it belongs to the user.
 * 2. If not provided → auto-select the user's first install location.
 *
 * Throws if the location is not found or doesn't belong to the user.
 */
export async function getActiveLocation(
  searchParams: Record<string, string | string[] | undefined>
): Promise<string> {
  const raw = searchParams.locationId
  const locationId = Array.isArray(raw) ? raw[0] : raw

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const supabase = createAdminClient()

  // Check if super_admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const isSuperAdmin = profile?.role === 'super_admin'

  if (locationId) {
    if (isSuperAdmin) {
      // Super admin can access any connected location
      const { data } = await supabase
        .from('ghl_connections')
        .select('location_id')
        .eq('location_id', locationId)
        .limit(1)
        .single()
      if (!data) throw new Error('Location not connected')
      return locationId
    }

    const { data } = await supabase
      .from('installs')
      .select('location_id')
      .eq('user_id', user.id)
      .eq('location_id', locationId)
      .limit(1)
      .single()

    if (!data) throw new Error('Location not found or access denied')
    return locationId
  }

  if (isSuperAdmin) {
    // Auto-select first connected location
    const { data: conn } = await supabase
      .from('ghl_connections')
      .select('location_id')
      .limit(1)
      .single()
    if (!conn?.location_id) throw new Error('No connected location found')
    return conn.location_id
  }

  // Auto-select first install
  const { data: install } = await supabase
    .from('installs')
    .select('location_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!install?.location_id) throw new Error('No connected location found')
  return install.location_id
}

/**
 * Validates that the current user owns the given locationId.
 * Use inside server actions before calling getGhlClient.
 *
 * Checks profile_locations (RBAC) first, falls back to installs for backward compat.
 */
export async function assertUserOwnsLocation(locationId: string): Promise<void> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const supabase = createAdminClient()

  // Super admins can access any location
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role === 'super_admin') return

  // Check RBAC membership (any role = access)
  const { data: membership } = await supabase
    .from('profile_locations')
    .select('role')
    .eq('user_id', user.id)
    .eq('location_id', locationId)
    .limit(1)
    .single()
  if (membership) return

  // Backward compat: check installs table
  const { data } = await supabase
    .from('installs')
    .select('location_id')
    .eq('user_id', user.id)
    .eq('location_id', locationId)
    .limit(1)
    .single()

  if (!data) throw new Error('Location not found or access denied')
}

/**
 * Validates that the current user has at least the specified role for a location.
 * Use in server actions that need role-based access control.
 */
export async function assertUserRole(
  locationId: string,
  minimumRole: 'viewer' | 'team_member' | 'location_admin',
): Promise<void> {
  const { requireLocationRole } = await import('@/lib/auth/checkRole')
  await requireLocationRole(locationId, minimumRole)
}
