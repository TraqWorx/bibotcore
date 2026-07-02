import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'
import { parsePageParams, isApptStatusFilter, statusValuesFor } from '@/lib/bellessere/query'

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

// GET — cache-first read (fast). Supports filtering by date range, operator
// (userId), contact (contactId), status, plus limit/offset pagination so the
// appuntamenti/clienti views scale to thousands of appointments.
export async function GET(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const sp = req.nextUrl.searchParams
  const startTime = sp.get('startTime')
  const endTime = sp.get('endTime')
  const userId = sp.get('userId')
  const contactId = sp.get('contactId')
  const contactIdsParam = sp.get('contactIds')
  const filterContactIds = contactIdsParam ? contactIdsParam.split(',').filter(Boolean).slice(0, 200) : null
  const statusParam = sp.get('status')
  const paginate = sp.has('limit') || sp.has('offset')
  const { limit, offset } = parsePageParams(sp, 200, 500)

  // A date range is required unless filtering by a specific contact / set of contacts.
  if (!contactId && !filterContactIds && (!startTime || !endTime)) {
    return NextResponse.json({ error: 'startTime and endTime required' }, { status: 400 })
  }

  const sb = createAdminClient()

  let query = sb
    .from('cached_calendar_events')
    .select('ghl_id, calendar_id, contact_ghl_id, user_id, title, start_time, end_time, appointment_status', paginate ? { count: 'exact' } : {})
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .order('start_time', { ascending: true })

  if (startTime) query = query.gte('start_time', startTime)
  if (endTime) query = query.lte('start_time', endTime)
  if (userId) query = query.eq('user_id', userId)
  if (contactId) query = query.eq('contact_ghl_id', contactId)
  if (filterContactIds) query = query.in('contact_ghl_id', filterContactIds)
  if (statusParam && isApptStatusFilter(statusParam)) {
    const vals = statusValuesFor(statusParam)
    if (vals) query = query.in('appointment_status', vals)
  }
  if (paginate) query = query.range(offset, offset + limit - 1)

  const { data: rows, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Join contact names from cache
  const contactIds = [...new Set((rows ?? []).map(r => r.contact_ghl_id).filter(Boolean))] as string[]
  let contactMap: Record<string, string> = {}
  if (contactIds.length > 0) {
    const { data: contacts } = await sb
      .from('cached_contacts')
      .select('ghl_id, first_name, last_name')
      .eq('location_id', BELLESSERE_LOCATION_ID)
      .in('ghl_id', contactIds)
    for (const c of contacts ?? []) {
      contactMap[c.ghl_id] = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.ghl_id
    }
  }

  const events = (rows ?? []).map(r => ({
    id: r.ghl_id,
    calendarId: r.calendar_id,
    contactId: r.contact_ghl_id,
    userId: r.user_id,
    title: r.title,
    startTime: r.start_time,
    endTime: r.end_time,
    appointmentStatus: r.appointment_status,
    contactName: r.contact_ghl_id ? (contactMap[r.contact_ghl_id] ?? undefined) : undefined,
  }))

  const body: Record<string, unknown> = { events }
  if (paginate) {
    body.total = count ?? events.length
    body.hasMore = (count ?? 0) > offset + events.length
  }
  return NextResponse.json(body)
}

// POST — create appointment in GHL + write to cache immediately (no waiting for webhook)
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
  const text = await res.text()
  let data: Record<string, unknown> = {}
  try { data = JSON.parse(text) } catch { /* non-JSON GHL response */ }

  if (!res.ok) {
    const msg = (data.message as string) ?? (data.error as string) ?? text.slice(0, 300) ?? 'GHL error'
    return NextResponse.json({ error: msg }, { status: res.status })
  }

  // Write to cache immediately so the booking appears before the webhook fires
  if (data.id) {
    const sb = createAdminClient()
    await sb.from('cached_calendar_events').upsert({
      ghl_id: data.id,
      location_id: BELLESSERE_LOCATION_ID,
      calendar_id: body.calendarId ?? null,
      contact_ghl_id: body.contactId ?? null,
      user_id: (data.userId as string | null) ?? body.userId ?? null,
      title: body.title ?? null,
      start_time: body.startTime ?? null,
      end_time: body.endTime ?? null,
      appointment_status: body.appointmentStatus ?? 'confirmed',
      synced_at: new Date().toISOString(),
    }, { onConflict: 'location_id,ghl_id' })
  }

  return NextResponse.json(data)
}

// PUT — update appointment status in GHL + update cache immediately
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
  const putText = await res.text()
  let data: Record<string, unknown> = {}
  try { data = JSON.parse(putText) } catch { /* non-JSON GHL response */ }

  if (!res.ok) {
    const msg = (data.message as string) ?? (data.error as string) ?? putText.slice(0, 300) ?? 'GHL error'
    return NextResponse.json({ error: msg }, { status: res.status })
  }

  // Mirror the status change to cache immediately
  if (payload.appointmentStatus) {
    const sb = createAdminClient()
    await sb.from('cached_calendar_events')
      .update({ appointment_status: payload.appointmentStatus, synced_at: new Date().toISOString() })
      .eq('location_id', BELLESSERE_LOCATION_ID)
      .eq('ghl_id', eventId)
  }

  return NextResponse.json(data)
}
