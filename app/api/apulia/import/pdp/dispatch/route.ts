import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { triggerPdpContinue } from '../_continue-trigger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Driver endpoint hit by pg_cron every minute. Finds all running PDP
 * imports and pings their /continue endpoint. Belt-and-suspenders
 * for cases where the self-trigger after a chunk didn't actually
 * leave the box before Vercel terminated the parent function.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret') ?? req.nextUrl.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const sb = createAdminClient()
  const { data: rows } = await sb
    .from('apulia_imports')
    .select('id, last_continue_at, last_progress_at, progress_done, progress_total')
    .eq('status', 'running')
    .eq('kind', 'pdp')

  let triggered = 0, skipped = 0
  for (const r of rows ?? []) {
    // Skip if a /continue already ran in the last 30 seconds — likely still in flight.
    const lastTouch = r.last_continue_at ?? r.last_progress_at
    if (lastTouch && Date.now() - new Date(lastTouch).getTime() < 30_000) {
      skipped++
      continue
    }
    await triggerPdpContinue(r.id)
    triggered++
  }
  return NextResponse.json({ triggered, skipped, running: (rows ?? []).length })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
