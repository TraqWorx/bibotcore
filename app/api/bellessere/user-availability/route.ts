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

  // Debug: probe multiple paths to find schedules
  const firstUserId = userIds[0]
  const [
    calsData,
    schedTrailing,
    schedList,
    schedUser,
  ] = await Promise.all([
    // All calendars — check if any have userId / type=personal
    fetch(`${GHL}/calendars/?locationId=${BELLESSERE_LOCATION_ID}`, { headers: { Authorization: `Bearer ${token}`, Version: '2021-04-15' } }).then(r => r.json()),
    // GET /calendars/schedules/ (trailing slash)
    fetch(`${GHL}/calendars/schedules/?locationId=${BELLESSERE_LOCATION_ID}`, { headers: { Authorization: `Bearer ${token}`, Version: 'v3' } }).then(r => r.json()),
    // GET /calendars/schedules/list
    fetch(`${GHL}/calendars/schedules/list?locationId=${BELLESSERE_LOCATION_ID}`, { headers: { Authorization: `Bearer ${token}`, Version: 'v3' } }).then(r => r.json()),
    // GET /calendars/schedules?userId=firstUser
    fetch(`${GHL}/calendars/schedules?userId=${firstUserId}`, { headers: { Authorization: `Bearer ${token}`, Version: 'v3' } }).then(r => r.json()),
  ])

  // Summarise calendars to avoid huge response
  const calSummary = (calsData.calendars ?? []).map((c: Record<string, unknown>) => ({
    id: c.id, name: c.name, calendarType: c.calendarType, userId: c.userId ?? null,
  }))

  return NextResponse.json({
    calendars: calSummary,
    schedTrailing,
    schedList,
    schedUser,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
