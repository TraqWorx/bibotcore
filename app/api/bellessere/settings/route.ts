import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccessFast } from '@/lib/auth/assertLocationAccess'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const access = await getLocationAccessFast(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = createAdminClient()
  const [{ data }, { data: settings }] = await Promise.all([
    sb.from('dashboard_configs').select('theme').eq('location_id', BELLESSERE_LOCATION_ID).single(),
    sb.from('bellessere_settings').select('invite_text').eq('location_id', BELLESSERE_LOCATION_ID).maybeSingle(),
  ])

  const theme = (data?.theme as Record<string, unknown>) ?? {}
  return NextResponse.json({
    teamSchedule: theme.teamSchedule ?? {},
    inviteText: settings?.invite_text ?? '',
  })
}

// PUT — save the waiting-list invite text template
export async function PUT(req: NextRequest) {
  const access = await getLocationAccessFast(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { inviteText } = await req.json().catch(() => ({})) as { inviteText?: string }
  const sb = createAdminClient()
  const { error } = await sb.from('bellessere_settings').upsert({
    location_id: BELLESSERE_LOCATION_ID, invite_text: (inviteText ?? '').slice(0, 1000), updated_at: new Date().toISOString(),
  }, { onConflict: 'location_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// POST — save team schedules to DB (internal reference only; GHL drives availability from user profile schedules)
export async function POST(req: NextRequest) {
  const access = await getLocationAccessFast(req, BELLESSERE_LOCATION_ID)
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
