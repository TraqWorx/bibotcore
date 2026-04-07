import { createAdminClient } from '@/lib/supabase-server'

/**
 * Get the agency for a given user ID.
 * Returns null if the user has no agency_id set.
 */
export async function getAgencyForUser(userId: string) {
  const sb = createAdminClient()
  const { data: profile } = await sb
    .from('profiles')
    .select('agency_id')
    .eq('id', userId)
    .single()

  if (!profile?.agency_id) return null

  const { data: agency } = await sb
    .from('agencies')
    .select('id, name, email, ghl_company_id, ghl_agency_token, stripe_customer_id')
    .eq('id', profile.agency_id)
    .single()

  return agency
}
