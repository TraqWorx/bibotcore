import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { locationId, iconUrl, welcomeMessage, autoInvite } = body

  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const sb = createAdminClient()
  const { error } = await sb.from('location_settings').upsert({
    location_id: locationId,
    portal_icon_url: iconUrl || null,
    portal_welcome_message: welcomeMessage || null,
    portal_auto_invite: autoInvite ?? false,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'location_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
