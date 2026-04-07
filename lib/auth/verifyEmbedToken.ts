import { createAdminClient } from '@/lib/supabase-server'

/**
 * Verifies an embed token and returns the dashboard config if valid.
 * The token must match the locationId in the URL.
 */
export async function verifyEmbedToken(locationId: string, token: string) {
  const sb = createAdminClient()

  const { data } = await sb
    .from('dashboard_configs')
    .select('id, location_id, config, agency_id')
    .eq('location_id', locationId)
    .eq('embed_token', token)
    .single()

  return data
}
