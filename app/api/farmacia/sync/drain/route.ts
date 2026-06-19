import { NextRequest, NextResponse } from 'next/server'
import { drainQueue, recoverStaleInProgress, countDuePending } from '@/lib/farmacia/sync-worker'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/** Drain the Farmacia outbound sync queue. Internal-only (x-internal-secret = CRON_SECRET). */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const TIME_BUDGET_MS = 240_000
  const recovered = await recoverStaleInProgress()

  let totalClaimed = 0
  let totalCompleted = 0
  let totalFailed = 0
  let rateLimited = false

  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    const r = await drainQueue()
    totalClaimed += r.claimed
    totalCompleted += r.completed
    totalFailed += r.failed
    if (r.rateLimited) { rateLimited = true; break }
    if (r.claimed === 0) break
  }

  const stillDue = await countDuePending()
  return NextResponse.json({
    recovered, claimed: totalClaimed, completed: totalCompleted,
    failed: totalFailed, rateLimited, stillDue, elapsedMs: Date.now() - startedAt,
  })
}

export async function GET(req: NextRequest) { return POST(req) }
