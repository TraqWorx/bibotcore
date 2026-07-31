import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccessFast } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'
import { assertBellessereWrite } from '@/lib/bellessere/auth'

export const dynamic = 'force-dynamic'

const GHL = 'https://services.leadconnectorhq.com'
const V = '2021-04-15'
const CLOSURE_TITLE = 'Chiusura salone'

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
  const all = [...byId.values()]

  // Salon closures are per-operator blocks tagged with CLOSURE_TITLE; group
  // them (by start|end) into one closure so they show/delete as a unit, and
  // keep them out of the per-operator absence list.
  const closureMap = new Map<string, { startTime: string; endTime: string; ids: string[] }>()
  const absences: { id: string; userId: string | null; title: string | null; startTime: string; endTime: string }[] = []
  for (const e of all) {
    if (String(e.title) === CLOSURE_TITLE) {
      const start = String(e.startTime ?? ''); const end = String(e.endTime ?? '')
      const k = start + '|' + end
      const g = closureMap.get(k) ?? { startTime: start, endTime: end, ids: [] }
      g.ids.push(String(e.id))
      closureMap.set(k, g)
    } else {
      absences.push({
        id: String(e.id),
        userId: (e.assignedUserId as string) ?? (e.userId as string) ?? null,
        title: (e.title as string) ?? null,
        startTime: String(e.startTime ?? ''),
        endTime: String(e.endTime ?? ''),
      })
    }
  }
  return NextResponse.json({ absences, closures: [...closureMap.values()] })
}

// POST — block a day (or a time range) for one operator. Admin-only.
export async function POST(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err
  const werr = await assertBellessereWrite()
  if (werr) return werr

  const { userId, date, endDate, from, to, title, scope } = await req.json().catch(() => ({})) as {
    userId?: string; date?: string; endDate?: string; from?: string; to?: string; title?: string; scope?: string
  }
  const isClosure = scope === 'closure'
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Data (YYYY-MM-DD) obbligatoria' }, { status: 400 })
  }
  if (!isClosure && !userId) {
    return NextResponse.json({ error: 'userId obbligatorio' }, { status: 400 })
  }
  // Multi-day range: one block spanning from `date` 00:00 to `endDate` 23:59.
  // A salon closure is always whole days; single absences may take a time range.
  const lastDay = endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate !== date ? endDate : null
  if (lastDay && lastDay < date) {
    return NextResponse.json({ error: 'La data finale precede quella iniziale' }, { status: 400 })
  }
  if (lastDay && (new Date(lastDay).getTime() - new Date(date).getTime()) > 60 * 24 * 3600_000) {
    return NextResponse.json({ error: 'Intervallo troppo lungo (max 60 giorni)' }, { status: 400 })
  }
  const wholeDays = isClosure || !!lastDay
  const startTime = new Date(`${date}T${wholeDays ? '00:00' : (from ?? '00:00')}:00${romeOffset(date)}`).toISOString()
  const endDay = lastDay ?? date
  const endTime = new Date(`${endDay}T${wholeDays ? '23:59' : (to ?? '23:59')}:59${romeOffset(endDay)}`).toISOString()
  if (new Date(startTime) >= new Date(endTime)) {
    return NextResponse.json({ error: 'Orario non valido' }, { status: 400 })
  }

  const token = await getToken()

  async function block(assignedUserId: string, blockTitle: string) {
    return fetch(`${GHL}/calendars/events/block-slots`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Version: V, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: BELLESSERE_LOCATION_ID, assignedUserId, startTime, endTime, title: blockTitle }),
    })
  }

  // Salon closure: block every operator for the range in one action.
  if (isClosure) {
    const sb = createAdminClient()
    const { data: users } = await sb.from('bellessere_users').select('id').eq('location_id', BELLESSERE_LOCATION_ID)
    const ids = (users ?? []).map(u => u.id as string)
    if (ids.length === 0) return NextResponse.json({ error: 'Nessun operatore nel team' }, { status: 400 })
    const results = await Promise.all(ids.map(uid => block(uid, CLOSURE_TITLE).then(r => r.ok).catch(() => false)))
    const ok = results.filter(Boolean).length
    if (ok === 0) return NextResponse.json({ error: 'Chiusura non riuscita' }, { status: 502 })
    return NextResponse.json({ ok: true, blocked: ok, total: ids.length })
  }

  const res = await block(userId!, title?.trim() || 'Assenza')
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

  const { eventId, eventIds } = await req.json().catch(() => ({})) as { eventId?: string; eventIds?: string[] }
  const ids = Array.isArray(eventIds) && eventIds.length ? eventIds : (eventId ? [eventId] : [])
  if (ids.length === 0) return NextResponse.json({ error: 'eventId obbligatorio' }, { status: 400 })

  const token = await getToken()
  const results = await Promise.all(ids.map(id =>
    fetch(`${GHL}/calendars/events/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, Version: V } })
      .then(r => r.status === 200 || r.status === 204)
      .catch(() => false),
  ))
  const ok = results.filter(Boolean).length
  if (ok === 0) return NextResponse.json({ error: 'Errore GHL' }, { status: 502 })
  return NextResponse.json({ ok: true, deleted: ok, total: ids.length })
}
