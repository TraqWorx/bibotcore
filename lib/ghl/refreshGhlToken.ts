import { createAdminClient } from '@/lib/supabase-server'

export async function refreshGhlToken(
  locationId: string,
  refreshToken: string
): Promise<string> {
  const res = await fetch('https://services.leadconnectorhq.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.GHL_CLIENT_ID!,
      client_secret: process.env.GHL_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GHL token refresh failed: ${body}`)
  }

  const data = await res.json()
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  const supabase = createAdminClient()
  // Compare-and-swap: only overwrite if the refresh_token we consumed is still
  // the current one. GHL rotates refresh tokens (single-use), so if a
  // concurrent refresh already advanced the row, our write would clobber the
  // newer token with our now-consumed one and brick the connection. When the
  // CAS matches nothing, another writer won the race — return their fresh
  // access token instead of ours.
  const { data: updated } = await supabase
    .from('ghl_connections')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
      refreshed_at: new Date().toISOString(),
    })
    .eq('location_id', locationId)
    .eq('refresh_token', refreshToken)
    .select('access_token')

  if (!updated || updated.length === 0) {
    const { data: current } = await supabase
      .from('ghl_connections')
      .select('access_token')
      .eq('location_id', locationId)
      .maybeSingle()
    if (current?.access_token) return current.access_token
  }

  return data.access_token
}
