import { NextRequest, NextResponse } from 'next/server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { getBulkJobs } from '@/lib/sync/bulkActions'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const access = await getLocationAccess(req, locationId)
  if (access.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (access.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const jobs = await getBulkJobs(locationId)
  return NextResponse.json({ jobs })
}
