import { NextRequest, NextResponse } from 'next/server'
import { countDuePending } from '@/lib/apulia/sync-worker'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Lightweight dispatch ping. pg_cron hits this every minute; if there's
 * outstanding work, it kicks off /drain (fire-and-forget) and returns.
 * The /drain function does the actual processing.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const due = await countDuePending()
  if (due === 0) {
    return NextResponse.json({ due: 0, drained: false })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://core.bibotcrm.it'
  const drainUrl = `${baseUrl}/api/apulia/sync/drain`

  // Fire-and-forget: detach with a 5s timeout abort so this dispatcher
  // returns quickly even if /drain is still booting. We don't await the
  // response — the body will be consumed inside /drain.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  fetch(drainUrl, {
    method: 'POST',
    headers: { 'x-internal-secret': process.env.CRON_SECRET, 'Content-Type': 'application/json' },
    signal: controller.signal,
  }).catch((err) => {
    if (err?.name === 'AbortError') return
    console.error('[apulia-sync-dispatch] /drain trigger failed:', err)
  }).finally(() => clearTimeout(timeout))

  return NextResponse.json({ due, drained: true })
}

export async function GET(req: NextRequest) { return POST(req) }
