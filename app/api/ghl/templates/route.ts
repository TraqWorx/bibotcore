import { NextRequest, NextResponse } from 'next/server'
import { getGhlClient } from '@/lib/ghl/ghlClient'

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  const type = req.nextUrl.searchParams.get('type') ?? 'sms'
  if (!locationId) return NextResponse.json({ templates: [] })

  try {
    const ghl = await getGhlClient(locationId)
    const data = type === 'whatsapp'
      ? await ghl.templates.whatsapp()
      : await ghl.templates.sms()
    return NextResponse.json({ templates: data?.templates ?? [] })
  } catch (err) {
    console.error('[api/ghl/templates]', err)
    return NextResponse.json({ templates: [] })
  }
}
