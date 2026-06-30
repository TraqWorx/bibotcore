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

  // Fetch full details of Adriana's Personal Calendar to see openHours + userId fields
  const adrianaCalId = '9XiWbEpTXnJGGa9ToTZa'
  const calRes = await fetch(`${GHL}/calendars/${adrianaCalId}`, {
    headers: { Authorization: `Bearer ${token}`, Version: '2021-04-15' },
  })
  const calData = await calRes.json()

  return NextResponse.json({ calendar: calData }, { headers: { 'Cache-Control': 'no-store' } })
}
