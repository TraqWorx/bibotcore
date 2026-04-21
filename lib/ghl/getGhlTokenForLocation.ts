import { createAdminClient } from '@/lib/supabase-server'
import { refreshIfNeeded } from './refreshIfNeeded'

/**
 * Fetches a valid GHL access token for a location using the service-role client.
 * Used server-side without a user session (e.g. webhooks, getGhlClient).
 */
export async function getGhlTokenForLocation(locationId: string): Promise<string> {
  const supabase = createAdminClient()
  const { data: connection } = await supabase
    .from('ghl_connections')
    .select('access_token, refresh_token, expires_at, company_id')
    .eq('location_id', locationId)
    .single()

  if (!connection?.access_token) {
    throw new Error(`No GHL connection found for location ${locationId}`)
  }

  return refreshIfNeeded(locationId, connection)
}
