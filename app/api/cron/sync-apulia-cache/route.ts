import { NextRequest, NextResponse } from 'next/server'
import { fullSyncCache } from '@/lib/apulia/cache'
import { isCronAuthorized } from '@/lib/auth/cronAuth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const r = await fullSyncCache()
    return NextResponse.json(r)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
