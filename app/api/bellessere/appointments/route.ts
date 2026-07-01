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

// GET — read from cached_calendar_events or GHL directly (when userId filter is active)
export async function GET(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const sp = req.nextUrl.searchParams
  const startTime = sp.get('startTime')
  const endTime = sp.get('endTime')
  const userId = sp.get('userId')
  if (!startTime || !endTime) return NextResponse.json({ error: 'startTime and endTime required' }, { status: 400 })

  const sb = createAdminClient()

  // When filtering by user: call GHL API directly — cache may lack user_id for unassigned events
  if (userId) {
    const token = await getToken().catch(() => null)
    if (token) {
      const startMs = new Date(startTime).getTime()
      const endMs = new Date(endTime).getTime()
      const ghlRes = await fetch(
        `${GHL}/calendars/events?locationId=${BELLESSERE_LOCATION_ID}&userId=${userId}&startTime=${startMs}&endTime=${endMs}&includeAll=true`,
        { headers: { Authorization: `Bearer ${token}`, Version: V } }
      ).catch(() => null)

      if (ghlRes?.ok) {
        const ghlData = await ghlRes.json().catch(() => ({})) as Record<string, unknown>
        const ghlEvents: Record<string, unknown>[] = (ghlData?.events as Record<string, unknown>[]) ?? []

        // Join contact names from cache
        const contactIds = [...new Set(ghlEvents.map(e => e.contactId as string).filter(Boolean))]
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

        const events = ghlEvents.map(e => ({
          id: e.id as string,
          calendarId: e.calendarId as string ?? null,
          contactId: e.contactId as string ?? null,
          userId: ((e.userId ?? e.assignedUserId) as string) ?? null,
          title: e.title as string ?? null,
          startTime: e.startTime as string ?? null,
          endTime: e.endTime as string ?? null,
          appointmentStatus: ((e.appointmentStatus ?? e.status) as string) ?? null,
          contactName: e.contactId ? (contactMap[e.contactId as string] ?? undefined) : undefined,
        }))

        return NextResponse.json({ events })
      }
    }
  }

  // Default: read from cache (no userId filter, or GHL call failed)
  const { data: rows, error } = await sb
    .from('cached_calendar_events')
    .select('ghl_id, calendar_id, contact_ghl_id, user_id, title, start_time, end_time, appointment_status')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .gte('start_time', startTime)
    .lte('start_time', endTime)
    .order('start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Join contact names from cache
  const contactIds = [...new Set((rows ?? []).map(r => r.contact_ghl_id).filter(Boolean))]
  let contactMap: Record<string, string> = {}
  if (contactIds.length > 0) {
    const { data: contacts } = await sb
      .from('cached_contacts')
      .select('ghl_id, first_name, last_name')
      .eq('location_id', BELLESSERE_LOCATION_ID)
      .in('ghl_id', contactIds as string[])
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

  return NextResponse.json({ events })
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
