import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

const GHL = 'https://services.leadconnectorhq.com'

export async function GET(req: NextRequest) {
  const access = await getLocationAccess(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  const calendarId = sp.get('calendarId')
  const date = sp.get('date') // YYYY-MM-DD

  if (!calendarId || !date) return NextResponse.json({ error: 'calendarId and date required' }, { status: 400 })

  // Europe/Rome: UTC+2 in summer, UTC+1 in winter. Use explicit offset so there's no browser dependency.
  const startDate = new Date(`${date}T00:00:00+02:00`).getTime()
  const endDate = new Date(`${date}T23:59:59+02:00`).getTime()

  const sb = createAdminClient()
  const { data: conn } = await sb
    .from('ghl_connections')
    .select('access_token, refresh_token, expires_at, company_id')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .single()
  if (!conn) return NextResponse.json({ error: 'No GHL connection' }, { status: 500 })
  const token = await refreshIfNeeded(BELLESSERE_LOCATION_ID, conn)

  const url = `${GHL}/calendars/${calendarId}/free-slots?startDate=${startDate}&endDate=${endDate}&timezone=Europe%2FRome`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Version: '2021-04-15' } })
  const data = await res.json()

  // GHL returns either { _dates_: { "YYYY-MM-DD": { slots: [] } } } or { "YYYY-MM-DD": { slots: [] } }
  // Slot values may be full ISO strings ("2026-07-01T07:00:00+02:00") or plain "HH:MM" — normalise to HH:MM
  const dateEntry = data._dates_?.[date] ?? data[date]
  const slots: string[] = (dateEntry?.slots ?? []).map((s: string) => {
    const m = s.match(/T(\d{2}:\d{2})/)
    return m ? m[1] : s
  })

  return NextResponse.json({ slots })
}
