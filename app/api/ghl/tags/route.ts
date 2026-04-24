import { NextRequest, NextResponse } from 'next/server'
import { getGhlClient } from '@/lib/ghl/ghlClient'

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) return NextResponse.json({ tags: [] })

  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.tags.list()
    return NextResponse.json({ tags: data?.tags ?? [] })
  } catch (err) {
    console.error('[api/ghl/tags]', err)
    return NextResponse.json({ tags: [] })
  }
}
