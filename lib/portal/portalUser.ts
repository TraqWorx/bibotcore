import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase-server'

export type PortalUserResult =
  | { status: 'ok'; contactGhlId: string }
  | { status: 'other_location' }
  | { status: 'no_contact' }

/**
 * Finds the portal user's contact for this location, creating the mapping from
 * cached_contacts on first login. Cached per request so the layout and the page,
 * which render in parallel, share one lookup instead of racing each other.
 */
export const getPortalUser = cache(async (authUserId: string, email: string | undefined, locationId: string): Promise<PortalUserResult> => {
  const sb = createAdminClient()
  const { data: existing } = await sb
    .from('portal_users')
    .select('contact_ghl_id, location_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (existing) {
    return existing.location_id === locationId
      ? { status: 'ok', contactGhlId: existing.contact_ghl_id }
      : { status: 'other_location' }
  }
  if (!email) return { status: 'no_contact' }

  const { data: contact } = await sb
    .from('cached_contacts')
    .select('ghl_id')
    .eq('location_id', locationId)
    .ilike('email', email.toLowerCase())
    .limit(1)
    .maybeSingle()
  if (!contact) return { status: 'no_contact' }

  await sb.from('portal_users').upsert(
    { auth_user_id: authUserId, location_id: locationId, contact_ghl_id: contact.ghl_id },
    { onConflict: 'auth_user_id' },
  )
  return { status: 'ok', contactGhlId: contact.ghl_id }
})
