import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

const GHL = 'https://services.leadconnectorhq.com'
const CAL_V = '2021-04-15'
const USR_V = '2021-07-28'

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

// GET — list all calendars (= services) + location users
export async function GET(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const token = await getToken()
  const [calsRes, usersRes] = await Promise.all([
    fetch(`${GHL}/calendars/?locationId=${BELLESSERE_LOCATION_ID}`, {
      headers: { Authorization: `Bearer ${token}`, Version: CAL_V },
    }),
    fetch(`${GHL}/users/?locationId=${BELLESSERE_LOCATION_ID}`, {
      headers: { Authorization: `Bearer ${token}`, Version: USR_V },
    }),
  ])

  const groupsRes = await fetch(`${GHL}/calendars/groups?locationId=${BELLESSERE_LOCATION_ID}`, {
    headers: { Authorization: `Bearer ${token}`, Version: CAL_V },
  })
  const [cals, users, groups] = await Promise.all([calsRes.json(), usersRes.json(), groupsRes.json()])
  return NextResponse.json({ calendars: cals.calendars ?? [], users: users.users ?? [], groups: groups.groups ?? [] })
}

// POST — create a calendar (service)
// body: { name, description, duration, price, teamMembers: string[], color }
export async function POST(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const { name, description, duration, price, teamMembers = [], color = '#1B2E4A', groupId } = await req.json()
  if (!name || !duration) return NextResponse.json({ error: 'name and duration required' }, { status: 400 })

  const token = await getToken()
  const payload: Record<string, unknown> = {
    locationId: BELLESSERE_LOCATION_ID,
    name,
    description: description ?? '',
    slotDuration: Number(duration),
    slotInterval: Number(duration),
    eventColor: color,
    isActive: true,
    price: price ? Number(price) : undefined,
    teamMembers: teamMembers.map((id: string) => ({ userId: id, priority: 0, meetingLocationType: 'default' })),
    calendarType: 'service',
  }
  if (groupId) payload.groupId = groupId

  const res = await fetch(`${GHL}/calendars/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Version: CAL_V, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

// PUT — update a calendar
export async function PUT(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const { calendarId, name, description, duration, price, teamMembers, color, groupId } = await req.json()
  if (!calendarId) return NextResponse.json({ error: 'calendarId required' }, { status: 400 })

  const token = await getToken()
  const payload: Record<string, unknown> = {}
  if (name !== undefined) payload.name = name
  if (description !== undefined) payload.description = description
  if (duration !== undefined) { payload.slotDuration = Number(duration); payload.slotInterval = Number(duration) }
  if (price !== undefined) payload.price = Number(price)
  if (color !== undefined) payload.eventColor = color
  if (groupId !== undefined) payload.groupId = groupId
  if (teamMembers !== undefined) {
    payload.teamMembers = teamMembers.map((id: string) => ({ userId: id, priority: 0, meetingLocationType: 'default' }))
  }

  const res = await fetch(`${GHL}/calendars/${calendarId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, Version: CAL_V, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

// DELETE — delete a calendar
export async function DELETE(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const { calendarId } = await req.json()
  if (!calendarId) return NextResponse.json({ error: 'calendarId required' }, { status: 400 })

  const token = await getToken()
  const res = await fetch(`${GHL}/calendars/${calendarId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, Version: CAL_V },
  })
  return NextResponse.json({ ok: res.ok }, { status: res.status })
}
