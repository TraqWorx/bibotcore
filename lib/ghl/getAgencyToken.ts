import { createAdminClient } from '@/lib/supabase-server'

/**
 * Resolves the GHL agency token for a given agency ID.
 * For Bibot (first agency), falls back to the GHL_AGENCY_TOKEN env var.
 * For other agencies, reads from the agencies table.
 */
export async function getAgencyToken(agencyId: string): Promise<string | null> {
  const sb = createAdminClient()
  const { data: agency } = await sb
    .from('agencies')
    .select('ghl_agency_token, name')
    .eq('id', agencyId)
    .single()

  // If agency has a stored token, use it
  if (agency?.ghl_agency_token) return agency.ghl_agency_token

  // Fallback for Bibot: use env var
  if (agency?.name === 'Bibot' && process.env.GHL_AGENCY_TOKEN) {
    return process.env.GHL_AGENCY_TOKEN
  }

  return null
}
