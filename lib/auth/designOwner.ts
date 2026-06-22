import { createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'

type ProfileLite = { role?: string | null; agency_id?: string | null; location_id?: string | null } | null | undefined

/**
 * Platform owner or a Bibot-agency admin — unconditional access to any Bibot
 * design. A bare `role === 'admin'` on a NON-Bibot agency is never enough (every
 * paying agency owner is an admin; that would leak one client's data to another).
 */
export function isBibotAdmin(profile: ProfileLite): boolean {
  if (!profile) return false
  if (profile.role === 'super_admin') return true
  return !!profile.agency_id && isBibotAgency(profile.agency_id) && profile.role === 'admin'
}

/**
 * Access to a Bibot single-tenant client design (Apulia Power, Farmacia
 * Cialdella) installed at `designLocationId`.
 *
 * Allowed for: super_admin, a Bibot admin, OR a user explicitly assigned to that
 * design's location (via profile_locations, or profiles.location_id as a
 * fallback). A Bibot member assigned only to OTHER locations must NOT see a
 * design that isn't connected to one of their locations.
 */
export async function canAccessBibotDesign(
  userId: string,
  profile: ProfileLite,
  designLocationId: string,
): Promise<boolean> {
  if (isBibotAdmin(profile)) return true
  if (profile?.location_id === designLocationId) return true
  const sb = createAdminClient()
  const { data } = await sb
    .from('profile_locations')
    .select('location_id')
    .eq('user_id', userId)
    .eq('location_id', designLocationId)
    .maybeSingle()
  return !!data
}

/**
 * WRITE access to a Bibot design. Stricter than view: only super_admin, a Bibot
 * admin, or a user who is `location_admin` on that design's location may modify
 * data. `team_member` / `viewer` (i.e. a GHL "user") get view-only — their
 * write actions are rejected.
 */
export async function canWriteBibotDesign(
  userId: string,
  profile: ProfileLite,
  designLocationId: string,
): Promise<boolean> {
  if (isBibotAdmin(profile)) return true
  const sb = createAdminClient()
  const { data } = await sb
    .from('profile_locations')
    .select('role')
    .eq('user_id', userId)
    .eq('location_id', designLocationId)
    .maybeSingle()
  return data?.role === 'location_admin'
}

/**
 * Map a GHL sub-account user role to our per-location role. GHL only has
 * "admin" and "user"; admin → location_admin (view+write), everything else →
 * team_member (view-only). Used by sync/webhook so GHL is the source of truth.
 */
export function ghlRoleToLocationRole(ghlRole: string | null | undefined): 'location_admin' | 'team_member' {
  return String(ghlRole).toLowerCase() === 'admin' ? 'location_admin' : 'team_member'
}
