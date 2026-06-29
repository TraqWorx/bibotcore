import { NextRequest, NextResponse } from 'next/server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { locationId, iconUrl, welcomeMessage, autoInvite, aiReceptionist } = body

  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const access = await getLocationAccess(req, locationId)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = createAdminClient()
  const [{ data: profile }, { data: membership }] = await Promise.all([
    sb.from('profiles').select('role').eq('id', access.userId).single(),
    sb.from('profile_locations').select('role').eq('user_id', access.userId).eq('location_id', locationId).maybeSingle(),
  ])
  const canWriteSettings =
    profile?.role === 'super_admin' ||
    profile?.role === 'admin' ||
    membership?.role === 'location_admin'
  if (!canWriteSettings) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const update: Record<string, unknown> = { location_id: locationId, updated_at: new Date().toISOString() }
  if (iconUrl !== undefined) update.portal_icon_url = iconUrl || null
  if (welcomeMessage !== undefined) update.portal_welcome_message = welcomeMessage || null
  if (autoInvite !== undefined) update.portal_auto_invite = autoInvite
  if (aiReceptionist !== undefined) update.ai_receptionist = aiReceptionist
  const { error } = await sb.from('location_settings').upsert(update, { onConflict: 'location_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
