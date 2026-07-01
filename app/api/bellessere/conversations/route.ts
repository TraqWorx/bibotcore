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
  const { data, error } = await sb
    .from('cached_conversations')
    .select('ghl_id, contact_ghl_id, contact_name, type, last_message_body, last_message_date, last_message_direction, unread_count')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .order('last_message_date', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Back-fill missing contact names from cached_contacts
  const missingIds = (data ?? []).filter(c => !c.contact_name && c.contact_ghl_id).map(c => c.contact_ghl_id as string)
  let fallbackMap: Record<string, string> = {}
  if (missingIds.length > 0) {
    const { data: contacts } = await sb
      .from('cached_contacts')
      .select('ghl_id, first_name, last_name')
      .eq('location_id', BELLESSERE_LOCATION_ID)
      .in('ghl_id', missingIds)
    for (const c of contacts ?? []) {
      const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
      if (name) fallbackMap[c.ghl_id] = name
    }
  }

  const conversations = (data ?? []).map(c => ({
    id: c.ghl_id,
    contactId: c.contact_ghl_id ?? '',
    contactName: c.contact_name || (c.contact_ghl_id ? fallbackMap[c.contact_ghl_id] : '') || 'Sconosciuto',
    type: c.type ?? '',
    lastMessageBody: c.last_message_body ?? '',
    lastMessageDate: c.last_message_date ?? '',
    lastMessageDirection: c.last_message_direction ?? '',
    unreadCount: c.unread_count ?? 0,
  }))

  return NextResponse.json({ conversations })
}
