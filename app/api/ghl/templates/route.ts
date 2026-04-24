import { NextRequest, NextResponse } from 'next/server'
import { getGhlClient } from '@/lib/ghl/ghlClient'

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  const type = req.nextUrl.searchParams.get('type') ?? 'sms'
  if (!locationId) return NextResponse.json({ templates: [] })

  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.templates.list()
    const all = (data?.templates ?? []) as { id: string; name: string; body?: string; templateBody?: string; type?: string; status?: string }[]

    // Filter by type
    let filtered = all
    if (type === 'whatsapp') {
      filtered = all.filter((t) => (t.type ?? '').toLowerCase().includes('whatsapp'))
    } else if (type === 'sms') {
      filtered = all.filter((t) => {
        const tType = (t.type ?? '').toLowerCase()
        return tType === 'sms' || tType === '' || tType === 'snippet' || !tType.includes('whatsapp')
      })
    }

    return NextResponse.json({ templates: filtered })
  } catch (err) {
    console.error('[api/ghl/templates]', err instanceof Error ? err.message : err)
    return NextResponse.json({ templates: [] })
  }
}
