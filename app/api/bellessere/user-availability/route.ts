import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccessFast } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

const GHL = 'https://services.leadconnectorhq.com'
const V_SCHED = 'v3'

interface ScheduleRule {
  type: 'wday' | 'date'
  day?: string
  date?: string
  intervals: { from: string; to: string }[]
}

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

// GET — read schedules from DB (instant, no GHL dependency)
export async function GET(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const sb = createAdminClient()
  const { data: rows } = await sb
    .from('bellessere_schedules')
    .select('id, user_id, rules, timezone')
    .eq('location_id', BELLESSERE_LOCATION_ID)

  const scheduleMap: Record<string, { scheduleId: string; rules: ScheduleRule[]; timezone: string }> = {}
  for (const row of rows ?? []) {
    scheduleMap[row.user_id] = {
      scheduleId: row.id,
      rules: (row.rules ?? []) as ScheduleRule[],
      timezone: row.timezone ?? 'Europe/Rome',
    }
  }

  return NextResponse.json({ scheduleMap }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })
}

// POST — create schedule on GHL + insert into DB
export async function POST(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const { userId, userName, rules, timezone } = await req.json() as {
    userId: string; userName: string; rules: ScheduleRule[]; timezone?: string
  }
  if (!userId || !rules) return NextResponse.json({ error: 'userId and rules required' }, { status: 400 })

  const token = await getToken()
  const res = await fetch(`${GHL}/calendars/schedules`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Version: V_SCHED, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${userName} Schedule`,
      locationId: BELLESSERE_LOCATION_ID,
      userId,
      rules,
      timezone: timezone ?? 'Europe/Rome',
    }),
  })
  const data = await res.json()

  if (res.ok) {
    const schedId = data.schedule?.id ?? data.id
    if (schedId) {
      const sb = createAdminClient()
      await sb.from('bellessere_schedules').upsert({
        id: schedId,
        location_id: BELLESSERE_LOCATION_ID,
        user_id: userId,
        name: `${userName} Schedule`,
        rules,
        timezone: timezone ?? 'Europe/Rome',
        synced_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    }
  }

  return NextResponse.json(data, { status: res.status })
}

// PUT — update schedule on GHL + patch DB row
export async function PUT(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const { scheduleId, rules, timezone } = await req.json() as {
    scheduleId: string; rules: ScheduleRule[]; timezone?: string
  }
  if (!scheduleId || !rules) return NextResponse.json({ error: 'scheduleId and rules required' }, { status: 400 })

  const token = await getToken()
  const body: Record<string, unknown> = { rules }
  if (timezone) body.timezone = timezone

  const res = await fetch(`${GHL}/calendars/schedules/${scheduleId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, Version: V_SCHED, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()

  if (res.ok) {
    const sb = createAdminClient()
    const patch: Record<string, unknown> = { rules, synced_at: new Date().toISOString() }
    if (timezone) patch.timezone = timezone
    await sb.from('bellessere_schedules').update(patch).eq('id', scheduleId)
  }

  return NextResponse.json(data, { status: res.status })
}

// DELETE — delete schedule on GHL + remove from DB
export async function DELETE(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const { scheduleId } = await req.json() as { scheduleId: string }
  if (!scheduleId) return NextResponse.json({ error: 'scheduleId required' }, { status: 400 })

  const token = await getToken()
  const res = await fetch(`${GHL}/calendars/schedules/${scheduleId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, Version: V_SCHED },
  })

  if (res.status === 204 || res.status === 200) {
    const sb = createAdminClient()
    await sb.from('bellessere_schedules').delete().eq('id', scheduleId)
    return NextResponse.json({ ok: true })
  }

  const d = await res.json().catch(() => ({}))
  return NextResponse.json(d, { status: res.status })
}
