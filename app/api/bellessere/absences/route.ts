import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccessFast } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'
import { assertBellessereWrite } from '@/lib/bellessere/auth'

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
  const access = await getLocationAccessFast(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

function romeOffset(dateStr: string): string {
  return (new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${dateStr}T12:00:00Z`))
    .find(p => p.type === 'timeZoneName')?.value ?? 'GMT+02:00').replace('GMT', '')
}

// GET — upcoming blocked-off time ("assenze") per operator, next 90 days.
// GHL's blocked-slots endpoint 422s without a user filter, so fan out per
// roster member (small team, parallel requests).
export async function GET(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const sb = createAdminClient()
  const { data: users } = await sb
    .from('bellessere_users')
    .select('id')
    .eq('location_id', BELLESSERE_LOCATION_ID)
  const userIds = (users ?? []).map(u => u.id as string)
  if (userIds.length === 0) return NextResponse.json({ absences: [] })

  const token = await getToken()
  const start = Date.now() - 24 * 3600_000
  const end = Date.now() + 90 * 24 * 3600_000

  const perUser = await Promise.all(userIds.map(uid =>
    fetch(
      `${GHL}/calendars/blocked-slots?locationId=${BELLESSERE_LOCATION_ID}&userId=${uid}&startTime=${start}&endTime=${end}`,
      { headers: { Authorization: `Bearer ${token}`, Version: V }, cache: 'no-store' },
    )
      .then(r => (r.ok ? r.json() : { events: [] }))
      .then(d => (d?.events ?? []) as Record<string, unknown>[])
      .catch(() => [] as Record<string, unknown>[]),
  ))

  // Dedupe by id (a block could surface for multiple queries)
  const byId = new Map<string, Record<string, unknown>>()
  for (const evs of perUser) for (const e of evs) byId.set(String(e.id), e)

  const absences = [...byId.values()].map(e => ({
    id: String(e.id),
    userId: (e.assignedUserId as string) ?? (e.userId as string) ?? null,
    title: (e.title as string) ?? null,
    startTime: String(e.startTime ?? ''),
    endTime: String(e.endTime ?? ''),
  }))
  return NextResponse.json({ absences })
}

// POST — block a day (or a time range) for one operator. Admin-only.
export async function POST(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err
  const werr = await assertBellessereWrite()
  if (werr) return werr

  const { userId, date, from, to, title } = await req.json().catch(() => ({})) as {
    userId?: string; date?: string; from?: string; to?: string; title?: string
  }
  if (!userId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'userId e data (YYYY-MM-DD) obbligatori' }, { status: 400 })
  }
  const offset = romeOffset(date)
  const startTime = new Date(`${date}T${from ?? '00:00'}:00${offset}`).toISOString()
  const endTime = new Date(`${date}T${to ?? '23:59'}:59${offset}`).toISOString()
  if (new Date(startTime) >= new Date(endTime)) {
    return NextResponse.json({ error: 'Orario non valido' }, { status: 400 })
  }

  const token = await getToken()
  const res = await fetch(`${GHL}/calendars/events/block-slots`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Version: V, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locationId: BELLESSERE_LOCATION_ID,
      assignedUserId: userId,
      startTime,
      endTime,
      title: title?.trim() || 'Assenza',
    }),
  })
  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? (data.message as string[]).join(', ') : (data.message as string) ?? 'Errore GHL'
    return NextResponse.json({ error: msg }, { status: res.status })
  }
  return NextResponse.json({ ok: true, id: (data.id as string) ?? null })
}

// DELETE — cancel a blocked-off period. Admin-only.
export async function DELETE(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err
  const werr = await assertBellessereWrite()
  if (werr) return werr

  const { eventId } = await req.json().catch(() => ({})) as { eventId?: string }
  if (!eventId) return NextResponse.json({ error: 'eventId obbligatorio' }, { status: 400 })

  const token = await getToken()
  const res = await fetch(`${GHL}/calendars/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, Version: V },
  })
  if (!(res.status === 200 || res.status === 204)) {
    const d = await res.json().catch(() => ({})) as { message?: string }
    return NextResponse.json({ error: d.message ?? 'Errore GHL' }, { status: res.status })
  }
  return NextResponse.json({ ok: true })
}
