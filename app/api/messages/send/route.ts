import { NextRequest, NextResponse } from 'next/server'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'

const GHL = 'https://services.leadconnectorhq.com'
const HEADERS = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
  Version: '2021-04-15',
})

export async function POST(req: NextRequest) {
  try {
    const { locationId, contactId, type, message, attachments, scheduledTimestamp } = await req.json()

    if (!locationId || !contactId || !message?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const token = await getGhlTokenForLocation(locationId)

    // Find existing conversation for this contact
    const searchRes = await fetch(
      `${GHL}/conversations/search?contactId=${contactId}`,
      { headers: HEADERS(token) }
    )
    let conversationId: string | null = null
    if (searchRes.ok) {
      const data = await searchRes.json()
      conversationId = data?.conversations?.[0]?.id ?? null
    }

    // If no conversation exists, create one
    if (!conversationId) {
      const createRes = await fetch(`${GHL}/conversations/`, {
        method: 'POST',
        headers: HEADERS(token),
        body: JSON.stringify({ locationId, contactId }),
      })
      if (createRes.ok) {
        const created = await createRes.json()
        conversationId = created?.conversation?.id ?? null
      }
    }

    if (!conversationId) {
      return NextResponse.json({ error: 'Could not find or create conversation' }, { status: 404 })
    }

    // Build message payload
    const payload: Record<string, unknown> = {
      type: type === 'WhatsApp' ? 'WhatsApp' : 'SMS',
      contactId,
      conversationId,
      message: message.trim(),
    }
    if (attachments?.length) payload.attachments = attachments
    if (scheduledTimestamp) payload.scheduledTimestamp = scheduledTimestamp

    const res = await fetch(`${GHL}/conversations/messages`, {
      method: 'POST',
      headers: HEADERS(token),
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: err.message ?? 'GHL API error' }, { status: res.status })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/messages/send]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
