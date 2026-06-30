import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

const GHL = 'https://services.leadconnectorhq.com'
const V_SCHED = 'v3'
const V = '2021-04-15'

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

// GET — fetch each user's availability schedule from GHL
export async function GET(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const token = await getToken()

  // Get all location users
  const usersRes = await fetch(`${GHL}/users/?locationId=${BELLESSERE_LOCATION_ID}`, {
    headers: { Authorization: `Bearer ${token}`, Version: V },
  })
  const usersData = await usersRes.json()
  const users: { id: string }[] = usersData.users ?? []

  // Fetch schedule for each user in parallel via /calendars/schedules/search
  const scheduleMap: Record<string, { scheduleId: string; rules: ScheduleRule[]; timezone: string }> = {}
  await Promise.all(users.map(async (u) => {
    try {
      const res = await fetch(
        `${GHL}/calendars/schedules/search?locationId=${BELLESSERE_LOCATION_ID}&userId=${u.id}&limit=1`,
        { headers: { Authorization: `Bearer ${token}`, Version: V_SCHED } }
      )
      const data = await res.json()
      const sched = data.schedules?.[0]
      if (sched) {
        scheduleMap[u.id] = {
          scheduleId: sched.id,
          rules: (sched.rules ?? []) as ScheduleRule[],
          timezone: sched.timezone ?? 'Europe/Rome',
        }
      }
    } catch {
      // skip users where schedule fetch fails
    }
  }))

  return NextResponse.json({ scheduleMap }, { headers: { 'Cache-Control': 'private, no-store' } })
}

// PUT — update a user's schedule rules on GHL
export async function PUT(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const { scheduleId, rules, timezone } = await req.json() as {
    scheduleId: string
    rules: ScheduleRule[]
    timezone?: string
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
  return NextResponse.json(data, { status: res.status })
}
