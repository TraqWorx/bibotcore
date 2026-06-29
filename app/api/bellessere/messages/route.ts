import { NextRequest, NextResponse } from 'next/server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { getConversationMessages, sendMessage } from '@/app/designs/simfonia/conversations/_actions'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const access = await getLocationAccess(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const conversationId = req.nextUrl.searchParams.get('conversationId')
  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

  const messages = await getConversationMessages(BELLESSERE_LOCATION_ID, conversationId)
  return NextResponse.json({ messages })
}

export async function POST(req: NextRequest) {
  const access = await getLocationAccess(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { conversationId, contactId, message, type } = await req.json()
  if (!conversationId || !contactId || !message?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const result = await sendMessage(BELLESSERE_LOCATION_ID, conversationId, contactId, message, type ?? 'TYPE_PHONE')
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
