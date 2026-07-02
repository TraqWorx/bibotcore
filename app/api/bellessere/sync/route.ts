import { NextRequest, NextResponse } from 'next/server'
import { getLocationAccessFast } from '@/lib/auth/assertLocationAccess'
import { syncBellessere } from '@/lib/bellessere/sync'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

// POST — full sync from GHL (called automatically by ensureFresh; also usable as a manual trigger)
export async function POST(req: NextRequest) {
  const access = await getLocationAccessFast(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const scope = body?.scope === 'appointments' ? 'appointments'
    : body?.scope === 'users' ? 'users'
    : 'all'
  const result = await syncBellessere(scope)
  return NextResponse.json({ ok: true, synced: result })
}
