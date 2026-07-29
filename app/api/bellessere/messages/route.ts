import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccessFast } from '@/lib/auth/assertLocationAccess'
import { getConversationMessages } from '@/app/designs/simfonia/conversations/_actions'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

const GHL = 'https://services.leadconnectorhq.com'

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

export async function GET(req: NextRequest) {
  const access = await getLocationAccessFast(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const conversationId = req.nextUrl.searchParams.get('conversationId')
  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

  const messages = await getConversationMessages(BELLESSERE_LOCATION_ID, conversationId)
  return NextResponse.json({ messages })
}

export async function POST(req: NextRequest) {
  const access = await getLocationAccessFast(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { contactId, message, type } = await req.json()
  if (!contactId || !message?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Send by contactId — GHL finds or creates the conversation, so this works
  // even for a client who has never been messaged (e.g. a just-added in-salon
  // booking). A conversationId is no longer required.
  const token = await getToken()
  const res = await fetch(`${GHL}/conversations/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: type === 'SMS' || type === 'Email' || type === 'WhatsApp' ? type : 'SMS', contactId, message: message.trim() }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    return NextResponse.json({ error: err.message ?? 'Invio fallito' }, { status: res.status })
  }
  return NextResponse.json({ ok: true })
}
