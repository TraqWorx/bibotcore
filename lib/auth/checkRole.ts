/**
 * Tenant-level RBAC helpers.
 *
 * Role hierarchy (high → low):
 *   super_admin (platform) > location_admin > team_member > viewer
 *
 * Platform role lives in `profiles.role`.
 * Tenant role lives in `profile_locations.role`.
 */

import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

export type PlatformRole = 'super_admin' | 'user'
export type LocationRole = 'location_admin' | 'team_member' | 'viewer'

const ROLE_LEVEL: Record<string, number> = {
  super_admin: 100,
  location_admin: 80,
  team_member: 50,
  viewer: 10,
}

export interface UserRoles {
  userId: string
  platformRole: PlatformRole
  locationRole: LocationRole | null
  /** The effective role (highest of platform and location role) */
  effectiveLevel: number
}

/**
 * Get the current user's platform role and location role.
 * Returns null if user is not authenticated.
 */
export async function getUserRoles(locationId: string): Promise<UserRoles | null> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return null

  const sb = createAdminClient()

  const [{ data: profile }, { data: membership }] = await Promise.all([
    sb.from('profiles').select('role').eq('id', user.id).single(),
    sb.from('profile_locations').select('role').eq('user_id', user.id).eq('location_id', locationId).single(),
  ])

  const platformRole: PlatformRole = profile?.role === 'super_admin' ? 'super_admin' : 'user'
  const locationRole = (membership?.role as LocationRole) ?? null

  const platformLevel = ROLE_LEVEL[platformRole] ?? 0
  const locationLevel = locationRole ? (ROLE_LEVEL[locationRole] ?? 0) : 0
  const effectiveLevel = Math.max(platformLevel, locationLevel)

  return { userId: user.id, platformRole, locationRole, effectiveLevel }
}

/**
 * Assert the current user has at least the specified role for a location.
 * Throws if not authenticated or insufficient role.
 *
 * super_admin always passes. For non-super_admins, checks profile_locations.role.
 */
export async function requireLocationRole(
  locationId: string,
  minimumRole: LocationRole,
): Promise<UserRoles> {
  const roles = await getUserRoles(locationId)

  if (!roles) {
    throw new Error('Not authenticated')
  }

  const requiredLevel = ROLE_LEVEL[minimumRole] ?? 0

  if (roles.effectiveLevel < requiredLevel) {
    throw new Error(`Insufficient permissions: requires ${minimumRole}`)
  }

  return roles
}

/**
 * Check if a user has at least the given role (non-throwing version).
 */
export function hasMinimumRole(
  roles: UserRoles,
  minimumRole: LocationRole,
): boolean {
  return roles.effectiveLevel >= (ROLE_LEVEL[minimumRole] ?? 0)
}

/**
 * Check if user can write (team_member or above).
 */
export function canWrite(roles: UserRoles): boolean {
  return hasMinimumRole(roles, 'team_member')
}

/**
 * Check if user is an admin (location_admin or super_admin).
 */
export function isAdmin(roles: UserRoles): boolean {
  return hasMinimumRole(roles, 'location_admin')
}
