import { NextRequest, NextResponse } from 'next/server'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) return NextResponse.json({ tags: [] })

  const access = await getLocationAccess(req, locationId)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.tags.list()
    return NextResponse.json({ tags: data?.tags ?? [] })
  } catch (err) {
    console.error('[api/ghl/tags]', err)
    return NextResponse.json({ tags: [] })
  }
}
