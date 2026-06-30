import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

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

// POST — save team schedules to DB (internal reference only; GHL drives availability from user profile schedules)
export async function POST(req: NextRequest) {
  const access = await getLocationAccess(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { teamSchedule } = await req.json()

  const sb = createAdminClient()

  const { data: existing } = await sb
    .from('dashboard_configs')
    .select('theme')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .single()

  const theme = { ...(existing?.theme as Record<string, unknown> ?? {}), teamSchedule }

  await sb
    .from('dashboard_configs')
    .upsert({ location_id: BELLESSERE_LOCATION_ID, theme }, { onConflict: 'location_id' })

  return NextResponse.json({ ok: true })
}
