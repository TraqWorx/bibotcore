import type { createAdminClient } from '@/lib/supabase-server'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Ensure a GHL location member's platform profile is scoped to the location's
 * agency. Prevents the recurring "stray admin of a junk agency" drift where a
 * user who once self-signed-up (auto-creating their own agency + a Test
 * Location) keeps landing on the WRONG sub-account on login instead of the GHL
 * location they were actually added to.
 *
 * Conservative by design — it only acts when the profile's agency does NOT
 * match the location's agency (the unambiguous "wrong sub-account" case):
 *  - super_admin is never touched.
 *  - A legitimate owner of a *real* agency (owns an agency that has a connected,
 *    non-test location) is never touched — they're a genuine admin.
 *  - Everyone else gets re-scoped: agency_id := the location's agency, and a
 *    stray 'admin' role is demoted to 'agency'. Fixing scope / reducing
 *    privilege is always safe.
 *
 * Returns the applied changes (for logging) or null if nothing changed.
 */
export async function normalizeMemberScope(
  sb: Admin,
  profileId: string,
  locationId: string,
): Promise<{ role?: string; agency_id?: string } | null> {
  const { data: profile } = await sb
    .from('profiles')
    .select('role, agency_id')
    .eq('id', profileId)
    .maybeSingle()
  if (!profile || profile.role === 'super_admin') return null

  const { data: loc } = await sb
    .from('locations')
    .select('agency_id')
    .eq('location_id', locationId)
    .maybeSingle()
  const locAgency = loc?.agency_id
  if (!locAgency) return null

  // Already correctly scoped — leave role untouched (don't demote a co-admin
  // who is in the right agency; that's a deliberate role, not drift).
  if (profile.agency_id === locAgency) return null

  // Is this profile the owner of a *real* agency? (owns an agency that has a
  // connected, non-test location). If so, they're a genuine admin — never yank
  // them into another agency.
  const { data: owned } = await sb.from('agencies').select('id').eq('owner_user_id', profileId)
  for (const a of owned ?? []) {
    const { data: realLoc } = await sb
      .from('locations')
      .select('location_id')
      .eq('agency_id', a.id)
      .neq('location_id', 'test-location-001')
      .limit(1)
      .maybeSingle()
    if (realLoc) {
      const { data: conn } = await sb
        .from('ghl_connections')
        .select('location_id')
        .eq('location_id', realLoc.location_id)
        .maybeSingle()
      if (conn) return null // owns a real, connected agency → genuine admin
    }
  }

  // Stray / mis-scoped member → re-scope to the location's agency.
  const updates: { role?: string; agency_id?: string } = { agency_id: locAgency }
  if (profile.role === 'admin') updates.role = 'agency'

  await sb.from('profiles').update(updates).eq('id', profileId)
  console.log(`[normalizeMemberScope] re-scoped ${profileId} → ${JSON.stringify(updates)} (location ${locationId})`)
  return updates
}
