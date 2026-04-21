import { refreshGhlToken } from './refreshGhlToken'

const REFRESH_BUFFER_MS = 5 * 60 * 1000

export interface GhlConnection {
  access_token: string
  refresh_token?: string | null
  expires_at?: string | null
  company_id?: string | null
}

// Cache location tokens to avoid re-exchanging on every call
const locationTokenCache = new Map<string, { token: string; expiresAt: number }>()

function isCompanyToken(token: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
    return payload.authClass === 'Company'
  } catch {
    return false
  }
}

async function exchangeForLocationToken(companyToken: string, locationId: string, companyId: string): Promise<string | null> {
  // Check cache first
  const cached = locationTokenCache.get(locationId)
  if (cached && cached.expiresAt > Date.now()) return cached.token

  try {
    const res = await fetch('https://services.leadconnectorhq.com/oauth/locationToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${companyToken}`,
        Version: '2021-07-28',
      },
      body: new URLSearchParams({ companyId, locationId }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.access_token) {
      // Cache for 20 minutes (location tokens typically last 24h but we play it safe)
      locationTokenCache.set(locationId, { token: data.access_token, expiresAt: Date.now() + 20 * 60 * 1000 })
      return data.access_token
    }
    return null
  } catch {
    return null
  }
}

/**
 * Returns a valid access token, refreshing it automatically if within 5 minutes of expiry.
 * If the token is a company-level token, auto-exchanges it for a location-level token.
 */
export async function refreshIfNeeded(
  locationId: string,
  connection: GhlConnection
): Promise<string> {
  let token = connection.access_token

  // Refresh if expiring soon
  if (connection.expires_at && connection.refresh_token) {
    const expiresAt = new Date(connection.expires_at).getTime()
    if (Date.now() >= expiresAt - REFRESH_BUFFER_MS) {
      try {
        token = await refreshGhlToken(locationId, connection.refresh_token)
      } catch (err) {
        console.error('[refreshIfNeeded] Token refresh failed, using existing token:', err)
      }
    }
  }

  // If it's a company token, exchange for a location token
  if (isCompanyToken(token)) {
    const companyId = connection.company_id ?? process.env.GHL_COMPANY_ID ?? ''
    if (companyId) {
      const locToken = await exchangeForLocationToken(token, locationId, companyId)
      if (locToken) return locToken
    }
  }

  return token
}
