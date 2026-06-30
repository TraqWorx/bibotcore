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

// GET — return personal calendars matched to users (openHours = staff availability)
export async function GET(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const token = await getToken()
  const res = await fetch(`${GHL}/calendars/?locationId=${BELLESSERE_LOCATION_ID}`, {
    headers: { Authorization: `Bearer ${token}`, Version: V },
  })
  const data = await res.json()
  const calendars: Record<string, unknown>[] = data.calendars ?? []

  // Personal calendars are the source of truth for staff availability
  // teamMembers[0].userId links the calendar to a GHL user
  const personal = calendars
    .filter(c => c.calendarType === 'personal')
    .map(c => {
      const members = (c.teamMembers as { userId: string }[]) ?? []
      return {
        calendarId: c.id as string,
        name: c.name as string,
        userId: members[0]?.userId ?? null,
        openHours: c.openHours ?? {},
        slotDuration: c.slotDuration as number ?? 30,
        timezone: c.timezone as string ?? 'Europe/Rome',
      }
    })

  return NextResponse.json({ personal }, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  })
}

// PUT — update a personal calendar's openHours
// openHours format: [{ daysOfTheWeek: [1,2,3,4,5], hours: [{ openHour, openMinute, closeHour, closeMinute }] }]
export async function PUT(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const { calendarId, openHours } = await req.json()
  if (!calendarId) return NextResponse.json({ error: 'calendarId required' }, { status: 400 })

  const token = await getToken()
  const res = await fetch(`${GHL}/calendars/${calendarId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, Version: V, 'Content-Type': 'application/json' },
    body: JSON.stringify({ openHours }),
  })
  const result = await res.json()
  return NextResponse.json(result, { status: res.status })
}
