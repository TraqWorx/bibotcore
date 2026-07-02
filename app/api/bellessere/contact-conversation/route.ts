import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccessFast } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

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

// GET — find conversation for a contact, return { conversationId, contactId, messages[] }
export async function GET(req: NextRequest) {
  const access = await getLocationAccessFast(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const contactId = req.nextUrl.searchParams.get('contactId')
  if (!contactId) return NextResponse.json({ error: 'contactId required' }, { status: 400 })

  const token = await getToken()

  // Search GHL for this contact's conversation
  const searchRes = await fetch(
    `https://services.leadconnectorhq.com/conversations/search?locationId=${BELLESSERE_LOCATION_ID}&contactId=${contactId}&limit=1`,
    { headers: { Authorization: `Bearer ${token}`, Version: '2021-04-15' } }
  )
  const searchData = await searchRes.json()
  const conversations: Array<{ id: string }> = searchData.conversations ?? []

  if (conversations.length === 0) {
    return NextResponse.json({ conversationId: null, messages: [] })
  }

  const conversationId = conversations[0].id

  // Fetch messages for this conversation
  const msgRes = await fetch(
    `https://services.leadconnectorhq.com/conversations/${conversationId}/messages?limit=20`,
    { headers: { Authorization: `Bearer ${token}`, Version: '2021-04-15' } }
  )
  const msgData = await msgRes.json()
  const messages = (msgData.messages?.messages ?? msgData.messages ?? [])
    .map((m: { id: string; body?: string; direction?: string; dateAdded?: string; type?: unknown }) => ({
      id: m.id,
      body: m.body ?? '',
      direction: m.direction ?? 'inbound',
      dateAdded: m.dateAdded ?? '',
      type: m.type,
    }))
    .reverse()

  return NextResponse.json({ conversationId, messages })
}
