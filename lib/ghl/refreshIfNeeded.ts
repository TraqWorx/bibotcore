import { refreshGhlToken } from './refreshGhlToken'

const REFRESH_BUFFER_MS = 5 * 60 * 1000

export interface GhlConnection {
  access_token: string
  refresh_token?: string | null
  expires_at?: string | null
}

/**
 * Returns a valid access token, refreshing it automatically if within 5 minutes of expiry.
 * Called inside getGhlTokenForLocation and getGhlAccessToken.
 */
export async function refreshIfNeeded(
  locationId: string,
  connection: GhlConnection
): Promise<string> {
  if (connection.expires_at && connection.refresh_token) {
    const expiresAt = new Date(connection.expires_at).getTime()
    if (Date.now() >= expiresAt - REFRESH_BUFFER_MS) {
      try {
        return await refreshGhlToken(locationId, connection.refresh_token)
      } catch (err) {
        console.error('[refreshIfNeeded] Token refresh failed, using existing token:', err)
      }
    }
  }
  return connection.access_token
}
