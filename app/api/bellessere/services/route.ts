import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

const GHL = 'https://services.leadconnectorhq.com'
const CAL_V = '2021-04-15'

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

// GET — read from DB tables (instant, no GHL dependency)
export async function GET(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const sb = createAdminClient()
  const [svcRes, usersRes, groupsRes] = await Promise.all([
    sb.from('bellessere_services').select('*').eq('location_id', BELLESSERE_LOCATION_ID).eq('is_active', true).order('name'),
    sb.from('bellessere_users').select('*').eq('location_id', BELLESSERE_LOCATION_ID).order('name'),
    sb.from('bellessere_groups').select('*').eq('location_id', BELLESSERE_LOCATION_ID).order('name'),
  ])

  // Shape to match the GHL response format the UI already expects
  const calendars = (svcRes.data ?? []).map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    slotDuration: s.slot_duration,
    slotInterval: s.slot_interval,
    slotBuffer: s.slot_buffer,
    preBuffer: s.pre_buffer,
    price: s.price,
    groupId: s.group_id,
    teamMembers: s.team_members ?? [],
    isActive: s.is_active,
  }))

  const users = (usersRes.data ?? []).map(u => ({ id: u.id, name: u.name, email: u.email }))
  const groups = (groupsRes.data ?? []).map(g => ({ id: g.id, name: g.name }))

  return NextResponse.json({ calendars, users, groups }, {
    headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' },
  })
}

// POST — create on GHL + insert into DB
export async function POST(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const { name, description, duration, price, teamMembers = [], color = '#1B2E4A', groupId, slotInterval, slotBuffer, preBuffer } = await req.json()
  if (!name || !duration) return NextResponse.json({ error: 'name and duration required' }, { status: 400 })

  const token = await getToken()
  const ghlPayload: Record<string, unknown> = {
    locationId: BELLESSERE_LOCATION_ID,
    name,
    description: description ?? '',
    slotDuration: Number(duration),
    slotInterval: slotInterval != null ? Number(slotInterval) : Number(duration),
    eventColor: color,
    isActive: true,
    price: price ? Number(price) : undefined,
    teamMembers: teamMembers.map((id: string) => ({ userId: id, priority: 0, meetingLocationType: 'default' })),
    calendarType: 'service',
  }
  if (groupId) ghlPayload.groupId = groupId
  if (slotBuffer != null) ghlPayload.slotBuffer = Number(slotBuffer)
  if (preBuffer != null) ghlPayload.preBuffer = Number(preBuffer)

  const res = await fetch(`${GHL}/calendars/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Version: CAL_V, 'Content-Type': 'application/json' },
    body: JSON.stringify(ghlPayload),
  })
  const data = await res.json()

  if (res.ok) {
    const cal = data.calendar ?? data
    const sb = createAdminClient()
    await sb.from('bellessere_services').upsert({
      id: cal.id,
      location_id: BELLESSERE_LOCATION_ID,
      name,
      description: description ?? null,
      slot_duration: Number(duration),
      slot_interval: slotInterval != null ? Number(slotInterval) : Number(duration),
      slot_buffer: slotBuffer != null ? Number(slotBuffer) : null,
      pre_buffer: preBuffer != null ? Number(preBuffer) : null,
      price: price ? Number(price) : null,
      group_id: groupId ?? null,
      team_members: teamMembers.map((id: string) => ({ userId: id })),
      is_active: true,
      synced_at: new Date().toISOString(),
    }, { onConflict: 'id' })
  }

  return NextResponse.json(data, { status: res.status })
}

// PUT — update on GHL + patch DB row
export async function PUT(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const { calendarId, name, description, duration, price, teamMembers, color, groupId, slotInterval, slotBuffer, preBuffer } = await req.json()
  if (!calendarId) return NextResponse.json({ error: 'calendarId required' }, { status: 400 })

  const token = await getToken()
  const ghlPayload: Record<string, unknown> = {}
  if (name !== undefined) ghlPayload.name = name
  if (description !== undefined) ghlPayload.description = description
  if (duration !== undefined) ghlPayload.slotDuration = Number(duration)
  if (slotInterval !== undefined) ghlPayload.slotInterval = Number(slotInterval)
  else if (duration !== undefined) ghlPayload.slotInterval = Number(duration)
  if (slotBuffer !== undefined) ghlPayload.slotBuffer = Number(slotBuffer)
  if (preBuffer !== undefined) ghlPayload.preBuffer = Number(preBuffer)
  if (price !== undefined) ghlPayload.price = Number(price)
  if (color !== undefined) ghlPayload.eventColor = color
  if (groupId !== undefined) ghlPayload.groupId = groupId
  if (teamMembers !== undefined) {
    ghlPayload.teamMembers = teamMembers.map((id: string) => ({ userId: id, priority: 0, meetingLocationType: 'default' }))
  }

  const res = await fetch(`${GHL}/calendars/${calendarId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, Version: CAL_V, 'Content-Type': 'application/json' },
    body: JSON.stringify(ghlPayload),
  })
  const data = await res.json()

  if (res.ok) {
    const sb = createAdminClient()
    const dbPatch: Record<string, unknown> = { synced_at: new Date().toISOString() }
    if (name !== undefined) dbPatch.name = name
    if (description !== undefined) dbPatch.description = description
    if (duration !== undefined) dbPatch.slot_duration = Number(duration)
    if (slotInterval !== undefined) dbPatch.slot_interval = Number(slotInterval)
    else if (duration !== undefined) dbPatch.slot_interval = Number(duration)
    if (slotBuffer !== undefined) dbPatch.slot_buffer = Number(slotBuffer)
    if (preBuffer !== undefined) dbPatch.pre_buffer = Number(preBuffer)
    if (price !== undefined) dbPatch.price = Number(price)
    if (groupId !== undefined) dbPatch.group_id = groupId
    if (teamMembers !== undefined) dbPatch.team_members = teamMembers.map((id: string) => ({ userId: id }))
    await sb.from('bellessere_services').update(dbPatch).eq('id', calendarId)
  }

  return NextResponse.json(data, { status: res.status })
}

// DELETE — delete on GHL + remove from DB
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

  if (res.ok) {
    const sb = createAdminClient()
    await sb.from('bellessere_services').delete().eq('id', calendarId)
  }

  return NextResponse.json({ ok: res.ok }, { status: res.status })
}
