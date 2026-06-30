import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

const GHL = 'https://services.leadconnectorhq.com'
const V = '2021-04-15'

async function getToken(): Promise<string> {
  const sb = createAdminClient()
  const { data: conn } = await sb
    .from('ghl_connections')
    .select('access_token, refresh_token, expires_at, company_id')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .single()
  if (!conn) throw new Error('No GHL connection for Bellessere')
  return refreshIfNeeded(BELLESSERE_LOCATION_ID, conn)
}

async function authCheck(req: NextRequest) {
  const access = await getLocationAccess(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

// GET — list events for a date range
export async function GET(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const sp = req.nextUrl.searchParams
  const startTime = sp.get('startTime')
  const endTime = sp.get('endTime')
  const userId = sp.get('userId') // optional: filter by staff member
  if (!startTime || !endTime) return NextResponse.json({ error: 'startTime and endTime required' }, { status: 400 })

  const token = await getToken()

  // Discover all active service calendars for this location
  const calsRes = await fetch(`${GHL}/calendars/?locationId=${BELLESSERE_LOCATION_ID}`, {
    headers: { Authorization: `Bearer ${token}`, Version: V },
  })
  const calsData = await calsRes.json()
  const calendarIds: string[] = (calsData.calendars ?? [])
    .filter((c: { calendarType?: string; isActive?: boolean }) => c.calendarType === 'service' && c.isActive !== false)
    .map((c: { id: string }) => c.id)

  // GHL /calendars/events requires calendarId, userId, or groupId — query per-calendar
  const fetchParams = userId
    ? [new URLSearchParams({ locationId: BELLESSERE_LOCATION_ID, startTime, endTime, userId })]
    : calendarIds.map(id => new URLSearchParams({ locationId: BELLESSERE_LOCATION_ID, startTime, endTime, calendarId: id }))

  const results = await Promise.all(
    fetchParams.map(params =>
      fetch(`${GHL}/calendars/events?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Version: V },
      }).then(r => r.json())
    )
  )

  // Deduplicate by event id (calendarId queries can overlap)
  const seen = new Set<string>()
  const events = results.flatMap(r => r.events ?? []).filter((e: { id: string }) => {
    if (seen.has(e.id)) return false
    seen.add(e.id); return true
  })

  return NextResponse.json({ events })
}

// POST — create appointment
export async function POST(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const body = await req.json()
  const token = await getToken()
  const res = await fetch(`${GHL}/calendars/events/appointments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Version: V, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, locationId: BELLESSERE_LOCATION_ID }),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

// PUT — update appointment (status, reschedule)
export async function PUT(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const body = await req.json()
  const { eventId, ...payload } = body
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })

  const token = await getToken()
  const res = await fetch(`${GHL}/calendars/events/appointments/${eventId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, Version: V, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
