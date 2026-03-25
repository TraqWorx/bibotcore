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
  await supabase
    .from('ghl_connections')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
    })
    .eq('location_id', locationId)

  return data.access_token
}
