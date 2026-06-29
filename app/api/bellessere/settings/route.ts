import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

const GHL = 'https://services.leadconnectorhq.com'

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

// GET — return saved team schedules
export async function GET(req: NextRequest) {
  const access = await getLocationAccess(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = createAdminClient()
  const { data } = await sb
    .from('dashboard_configs')
    .select('theme')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .single()

  const theme = (data?.theme as Record<string, unknown>) ?? {}
  return NextResponse.json({ teamSchedule: theme.teamSchedule ?? {} })
}

// POST — save team schedules and optionally sync openHours to all GHL calendars
// body: { teamSchedule: { [userId]: { mon: {open,start,end}, tue: ... } }, syncToGhl?: boolean }
export async function POST(req: NextRequest) {
  const access = await getLocationAccess(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { teamSchedule, syncToGhl = false } = await req.json()

  const sb = createAdminClient()

  // Read existing theme to preserve colors
  const { data: existing } = await sb
    .from('dashboard_configs')
    .select('theme')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .single()

  const theme = { ...(existing?.theme as Record<string, unknown> ?? {}), teamSchedule }

  await sb
    .from('dashboard_configs')
    .update({ theme })
    .eq('location_id', BELLESSERE_LOCATION_ID)

  if (!syncToGhl) return NextResponse.json({ ok: true })

  // Build GHL openHours from union of all active users' schedules
  // Format: { [dayKey]: [{ openHour, openMinute, closeHour, closeMinute }] }
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const openHours: Record<string, { open: boolean; hours?: { openHour: number; openMinute: number; closeHour: number; closeMinute: number }[] }> = {}

  for (const day of dayKeys) {
    const anyOpen = Object.values(teamSchedule as Record<string, Record<string, { open: boolean; start: string; end: string }>>)
      .some(sched => sched[day]?.open)
    if (!anyOpen) {
      openHours[day] = { open: false }
      continue
    }
    // Find earliest start and latest end across all users working that day
    let minH = 23, minM = 59, maxH = 0, maxM = 0
    for (const sched of Object.values(teamSchedule as Record<string, Record<string, { open: boolean; start: string; end: string }>>)) {
      const d = sched[day]
      if (!d?.open) continue
      const [sh, sm] = d.start.split(':').map(Number)
      const [eh, em] = d.end.split(':').map(Number)
      if (sh < minH || (sh === minH && sm < minM)) { minH = sh; minM = sm }
      if (eh > maxH || (eh === maxH && em > maxM)) { maxH = eh; maxM = em }
    }
    openHours[day] = { open: true, hours: [{ openHour: minH, openMinute: minM, closeHour: maxH, closeMinute: maxM }] }
  }

  // Apply to all active calendars
  const token = await getToken()
  const calRes = await fetch(`${GHL}/calendars/?locationId=${BELLESSERE_LOCATION_ID}`, {
    headers: { Authorization: `Bearer ${token}`, Version: '2021-04-15' },
  })
  const calData = await calRes.json()
  const calendars: { id: string }[] = (calData.calendars ?? []).filter((c: { calendarType?: string }) => c.calendarType === 'service')

  await Promise.all(
    calendars.map(cal =>
      fetch(`${GHL}/calendars/${cal.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, Version: '2021-04-15', 'Content-Type': 'application/json' },
        body: JSON.stringify({ openHours }),
      })
    )
  )

  return NextResponse.json({ ok: true, calendarsSynced: calendars.length })
}
