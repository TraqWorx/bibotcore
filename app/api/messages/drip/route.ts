import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { locationId, contactIds, type, message, imageUrl, batchSize, intervalMinutes, startAt } = await req.json()

    if (!locationId || !contactIds?.length || !message?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const sb = createAdminClient()
    const { error } = await sb.from('drip_jobs').insert({
      location_id: locationId,
      type: type === 'WhatsApp' ? 'WhatsApp' : 'SMS',
      message: message.trim(),
      image_url: imageUrl || null,
      contact_ids: contactIds,
      batch_size: Math.max(1, batchSize || 10),
      interval_minutes: Math.max(1, intervalMinutes || 60),
      start_at: startAt || null,
    })

    if (error) {
      console.error('[api/messages/drip] insert error:', error)
      return NextResponse.json({ error: 'Failed to create drip job' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/messages/drip]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
