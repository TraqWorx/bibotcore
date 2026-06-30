import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

const GHL = 'https://services.leadconnectorhq.com'
const V_SCHED = 'v3'
const V = '2021-04-15'
const SCHEDULES_TTL = 10 * 60 * 1000 // 10 minutes
const CACHE_KEY = '_schedulesCache'
const SERVICES_CACHE_KEY = '_servicesCache'

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
  const access = await getLocationAccess(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

async function getTheme(sb: ReturnType<typeof createAdminClient>) {
  const { data } = await sb
    .from('dashboard_configs')
    .select('theme')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .maybeSingle()
  return (data?.theme as Record<string, unknown>) ?? {}
}

async function mergeTheme(sb: ReturnType<typeof createAdminClient>, theme: Record<string, unknown>, patch: Record<string, unknown>) {
  await sb.from('dashboard_configs').upsert(
    { location_id: BELLESSERE_LOCATION_ID, theme: { ...theme, ...patch } },
    { onConflict: 'location_id' }
  )
}

// GET — fetch each user's availability schedule (DB-cached, 10min TTL)
export async function GET(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const sb = createAdminClient()
  const theme = await getTheme(sb)

  // L2 DB cache
  const cached = theme[CACHE_KEY] as { ts: number; data: unknown } | undefined
  if (cached && Date.now() - cached.ts < SCHEDULES_TTL) {
    return NextResponse.json(cached.data, { headers: { 'Cache-Control': 'private, max-age=300' } })
  }

  const token = await getToken()

  // Reuse users from services cache to avoid an extra GHL call
  let userIds: string[]
  const svcCache = theme[SERVICES_CACHE_KEY] as { ts: number; data: { users: { id: string }[] } } | undefined
  if (svcCache && Date.now() - svcCache.ts < 5 * 60 * 1000) {
    userIds = svcCache.data.users.map(u => u.id)
  } else {
    const res = await fetch(`${GHL}/users/?locationId=${BELLESSERE_LOCATION_ID}`, {
      headers: { Authorization: `Bearer ${token}`, Version: V },
    })
    const d = await res.json()
    userIds = (d.users ?? []).map((u: { id: string }) => u.id)
  }

  const scheduleMap: Record<string, { scheduleId: string; rules: ScheduleRule[]; timezone: string }> = {}
  await Promise.all(userIds.map(async (uid) => {
    try {
      const res = await fetch(
        `${GHL}/calendars/schedules/search?locationId=${BELLESSERE_LOCATION_ID}&userId=${uid}&limit=1`,
        { headers: { Authorization: `Bearer ${token}`, Version: V_SCHED } }
      )
      const data = await res.json()
      const sched = data.schedules?.[0]
      if (sched) {
        scheduleMap[uid] = {
          scheduleId: sched.id,
          rules: (sched.rules ?? []) as ScheduleRule[],
          timezone: sched.timezone ?? 'Europe/Rome',
        }
      }
    } catch { /* skip */ }
  }))

  const payload = { scheduleMap }
  mergeTheme(sb, theme, { [CACHE_KEY]: { ts: Date.now(), data: payload } }).catch(() => {})
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, max-age=300' } })
}

// POST — create a new schedule for a user
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
    const sb = createAdminClient()
    const theme = await getTheme(sb)
    const prev = (theme[CACHE_KEY] as { ts: number; data: { scheduleMap: Record<string, unknown> } } | undefined)
    if (prev) {
      const newId = data.schedule?.id ?? data.id
      if (newId) {
        prev.data.scheduleMap[userId] = { scheduleId: newId, rules, timezone: timezone ?? 'Europe/Rome' }
        mergeTheme(sb, theme, { [CACHE_KEY]: prev }).catch(() => {})
      }
    }
  }
  return NextResponse.json(data, { status: res.status })
}

// PUT — update a user's schedule rules
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

  // Update the cached entry for this schedule's rules so next GET returns fresh data
  if (res.ok) {
    const sb = createAdminClient()
    const theme = await getTheme(sb)
    const cached = theme[CACHE_KEY] as { ts: number; data: { scheduleMap: Record<string, { scheduleId: string; rules: ScheduleRule[]; timezone: string }> } } | undefined
    if (cached) {
      for (const uid of Object.keys(cached.data.scheduleMap)) {
        if (cached.data.scheduleMap[uid].scheduleId === scheduleId) {
          cached.data.scheduleMap[uid].rules = rules
          if (timezone) cached.data.scheduleMap[uid].timezone = timezone
        }
      }
      mergeTheme(sb, theme, { [CACHE_KEY]: cached }).catch(() => {})
    }
  }

  return NextResponse.json(data, { status: res.status })
}

// DELETE — remove a user's schedule
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
    // Remove from cache
    const sb = createAdminClient()
    const theme = await getTheme(sb)
    const cached = theme[CACHE_KEY] as { ts: number; data: { scheduleMap: Record<string, unknown> } } | undefined
    if (cached) {
      for (const uid of Object.keys(cached.data.scheduleMap)) {
        if ((cached.data.scheduleMap[uid] as { scheduleId: string }).scheduleId === scheduleId) {
          delete cached.data.scheduleMap[uid]
        }
      }
      mergeTheme(sb, theme, { [CACHE_KEY]: cached }).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
