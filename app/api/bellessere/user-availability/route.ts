import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

const GHL = 'https://services.leadconnectorhq.com'
const V = '2021-07-28'

// GET — fetch availability schedules for all (or a specific) user
// ?userId=xxx  for a single user; omit to get all location users
export async function GET(req: NextRequest) {
  const access = await getLocationAccess(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = createAdminClient()
  const { data: conn } = await sb
    .from('ghl_connections')
    .select('access_token, refresh_token, expires_at, company_id')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .single()
  if (!conn) return NextResponse.json({ error: 'No GHL connection' }, { status: 500 })
  const token = await refreshIfNeeded(BELLESSERE_LOCATION_ID, conn)

  const requestedUserId = req.nextUrl.searchParams.get('userId')

  let userIds: string[]
  if (requestedUserId) {
    userIds = [requestedUserId]
  } else {
    // Fetch all location users
    const usersRes = await fetch(`${GHL}/users/?locationId=${BELLESSERE_LOCATION_ID}`, {
      headers: { Authorization: `Bearer ${token}`, Version: V },
    })
    const usersData = await usersRes.json()
    userIds = (usersData.users ?? []).map((u: { id: string }) => u.id)
  }

  // Debug: try multiple approaches for the first user to find where schedules live
  const firstUserId = userIds[0]
  const tries = await Promise.all([
    fetch(`${GHL}/users/${firstUserId}/availability`, { headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' } }).then(r => r.json()).then(d => ({ endpoint: `users/${firstUserId}/availability v2021-07-28`, data: d })),
    fetch(`${GHL}/users/${firstUserId}/availability`, { headers: { Authorization: `Bearer ${token}`, Version: 'v3' } }).then(r => r.json()).then(d => ({ endpoint: `users/${firstUserId}/availability v3`, data: d })),
    fetch(`${GHL}/calendars/schedules/${firstUserId}`, { headers: { Authorization: `Bearer ${token}`, Version: 'v3' } }).then(r => r.json()).then(d => ({ endpoint: `calendars/schedules/${firstUserId} v3`, data: d })),
    fetch(`${GHL}/calendars/schedules/${firstUserId}`, { headers: { Authorization: `Bearer ${token}`, Version: '2021-04-15' } }).then(r => r.json()).then(d => ({ endpoint: `calendars/schedules/${firstUserId} v2021-04-15`, data: d })),
  ]).catch(() => [])

  return NextResponse.json({ firstUserId, userIds, tries }, { headers: { 'Cache-Control': 'no-store' } })
}
