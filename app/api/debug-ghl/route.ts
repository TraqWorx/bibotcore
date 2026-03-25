import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'

const BASE_URL = 'https://services.leadconnectorhq.com'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('locationId')

  if (!locationId) {
    return NextResponse.json({ error: 'locationId required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 1. Check connection exists
  const { data: connection } = await supabase
    .from('ghl_connections')
    .select('location_id, access_token, refresh_token, expires_at')
    .eq('location_id', locationId)
    .single()

  if (!connection) {
    return NextResponse.json({ error: 'No ghl_connections row for this location', locationId })
  }

  const tokenInfo = {
    hasAccessToken: !!connection.access_token,
    hasRefreshToken: !!connection.refresh_token,
    expiresAt: connection.expires_at,
    isExpired: connection.expires_at ? new Date(connection.expires_at) < new Date() : 'no expiry',
  }

  // 2. Try to get a valid token
  let token: string | null = null
  let tokenError: string | null = null
  try {
    token = await getGhlTokenForLocation(locationId)
  } catch (err) {
    tokenError = err instanceof Error ? err.message : String(err)
  }

  // 3. Try fetching contacts
  let contactsResult: unknown = null
  let contactsError: string | null = null
  if (token) {
    try {
      const res = await fetch(
        `${BASE_URL}/contacts/?locationId=${locationId}&limit=5`,
        {
          headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
          cache: 'no-store',
        }
      )
      if (!res.ok) {
        contactsError = `HTTP ${res.status}: ${await res.text()}`
      } else {
        const data = await res.json()
        contactsResult = {
          total: data?.total ?? data?.meta?.total ?? '?',
          contactCount: data?.contacts?.length ?? 0,
          firstContact: data?.contacts?.[0]
            ? {
                id: data.contacts[0].id,
                name: [data.contacts[0].firstName, data.contacts[0].lastName].filter(Boolean).join(' '),
                email: data.contacts[0].email,
                tags: data.contacts[0].tags,
              }
            : null,
        }
      }
    } catch (err) {
      contactsError = err instanceof Error ? err.message : String(err)
    }
  }

  return NextResponse.json({
    locationId,
    tokenInfo,
    tokenObtained: !!token,
    tokenError,
    contactsResult,
    contactsError,
  })
}
