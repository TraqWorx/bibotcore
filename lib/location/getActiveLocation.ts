'use server'

import { redirect } from 'next/navigation'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

/**
 * Resolves the active locationId for server pages.
 * Optimized: runs auth + profile + location check in parallel where possible.
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

  if (locationId) {
    // Run profile + access check in parallel
    const [{ data: profile }, { data: membership }, { data: install }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      supabase.from('profile_locations').select('role').eq('user_id', user.id).eq('location_id', locationId).maybeSingle(),
      supabase.from('installs').select('location_id').eq('user_id', user.id).eq('location_id', locationId).maybeSingle(),
    ])

    if (profile?.role === 'super_admin' || membership || install) {
      return locationId
    }
    throw new Error('Location not found or access denied')
  }

  // No locationId — auto-select
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role === 'super_admin') {
    const { data: conn } = await supabase.from('ghl_connections').select('location_id').limit(1).single()
    if (!conn?.location_id) throw new Error('No connected location found')
    return conn.location_id
  }

  const { data: install } = await supabase
    .from('installs').select('location_id').eq('user_id', user.id).limit(1).single()
  if (!install?.location_id) throw new Error('No connected location found')
  return install.location_id
}

/**
 * Validates that the current user owns the given locationId.
 * Optimized: parallel profile + membership + install check.
 */
export async function assertUserOwnsLocation(locationId: string): Promise<void> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const supabase = createAdminClient()

  // Run all checks in parallel
  const [{ data: profile }, { data: membership }, { data: install }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('profile_locations').select('role').eq('user_id', user.id).eq('location_id', locationId).maybeSingle(),
    supabase.from('installs').select('location_id').eq('user_id', user.id).eq('location_id', locationId).maybeSingle(),
  ])

  if (profile?.role === 'super_admin' || membership || install) return
  throw new Error('Location not found or access denied')
}

/**
 * Validates that the current user has at least the specified role for a location.
 */
export async function assertUserRole(
  locationId: string,
  minimumRole: 'viewer' | 'team_member' | 'location_admin',
): Promise<void> {
  const { requireLocationRole } = await import('@/lib/auth/checkRole')
  await requireLocationRole(locationId, minimumRole)
}
