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

// GET — list all schedules for the location (each has a userId linking it to a team member)
export async function GET(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const token = await getToken()
  const res = await fetch(`${GHL}/calendars/schedules?locationId=${BELLESSERE_LOCATION_ID}`, {
    headers: { Authorization: `Bearer ${token}`, Version: V },
  })
  const data = await res.json()
  // GHL returns { schedules: [...] } or { data: [...] }
  const schedules = data.schedules ?? data.data ?? data ?? []
  return NextResponse.json({ schedules }, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  })
}

// PUT — update an existing schedule's availability
export async function PUT(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const { scheduleId, availability, timezone } = await req.json()
  if (!scheduleId) return NextResponse.json({ error: 'scheduleId required' }, { status: 400 })

  const token = await getToken()
  const payload: Record<string, unknown> = { availability }
  if (timezone) payload.timezone = timezone

  const res = await fetch(`${GHL}/calendars/schedules/${scheduleId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, Version: V, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
