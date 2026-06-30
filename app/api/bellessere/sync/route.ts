import { NextRequest, NextResponse } from 'next/server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { syncBellessere } from '@/lib/bellessere/sync'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

// POST — full sync from GHL (called automatically by ensureFresh; also usable as a manual trigger)
export async function POST(req: NextRequest) {
  const access = await getLocationAccess(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await syncBellessere('all')
  return NextResponse.json({ ok: true, synced: result })
}
