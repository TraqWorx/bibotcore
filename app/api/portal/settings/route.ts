import { NextRequest, NextResponse } from 'next/server'
import { assertLocationAccess } from '@/lib/auth/assertLocationAccess'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { locationId, iconUrl, welcomeMessage, autoInvite, aiReceptionist } = body

  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const authUser = await assertLocationAccess(req, locationId)
  if (!authUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = createAdminClient()
  const update: Record<string, unknown> = { location_id: locationId, updated_at: new Date().toISOString() }
  if (iconUrl !== undefined) update.portal_icon_url = iconUrl || null
  if (welcomeMessage !== undefined) update.portal_welcome_message = welcomeMessage || null
  if (autoInvite !== undefined) update.portal_auto_invite = autoInvite
  if (aiReceptionist !== undefined) update.ai_receptionist = aiReceptionist
  const { error } = await sb.from('location_settings').upsert(update, { onConflict: 'location_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
