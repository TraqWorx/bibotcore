import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const locationId = req.nextUrl.searchParams.get('locationId')
  const conversationId = req.nextUrl.searchParams.get('conversationId')
  if (!locationId || !conversationId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const sb = createAdminClient()

  // Verify portal user owns this conversation
  const { data: portalUser } = await sb
    .from('portal_users')
    .select('contact_ghl_id, location_id')
    .eq('auth_user_id', user.id)
    .eq('location_id', locationId)
    .single()

  if (!portalUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify conversation belongs to this contact
  const { data: convo } = await sb
    .from('cached_conversations')
    .select('contact_ghl_id')
    .eq('location_id', locationId)
    .eq('ghl_id', conversationId)
    .single()

  if (!convo || convo.contact_ghl_id !== portalUser.contact_ghl_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get cached messages
  const { data: messages } = await sb
    .from('cached_messages')
    .select('ghl_id, body, direction, type, date_added')
    .eq('location_id', locationId)
    .eq('conversation_id', conversationId)
    .order('date_added', { ascending: true })

  return NextResponse.json({
    messages: (messages ?? []).map((m) => ({
      id: m.ghl_id,
      body: m.body ?? '',
      direction: m.direction ?? '',
      type: m.type ?? '',
      dateAdded: m.date_added ?? '',
    })),
  })
}
