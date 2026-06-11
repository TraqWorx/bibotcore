import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { bulkSyncLocation } from '@/lib/sync/bulkSync'
import { syncAllLocationUsers } from '@/lib/sync/syncAllUsers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Daily cron job — syncs all active locations' GHL data into cache.
 * Add to vercel.json:
 *   { "crons": [{ "path": "/api/cron/sync-ghl-cache", "schedule": "0 4 * * *" }] }
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createAdminClient()
  const started = Date.now()
  const BUDGET_MS = 240_000 // stop starting new locations ~60s before the 300s timeout

  // Get all active locations with GHL connections
  const { data: connections } = await sb
    .from('ghl_connections')
    .select('location_id')
    .not('access_token', 'is', null)

  if (!connections || connections.length === 0) {
    return NextResponse.json({ message: 'No active locations', synced: 0 })
  }

  // Order STALEST-FIRST so the most behind locations get priority each run and
  // none is perpetually starved when a run can't finish everyone in 300s.
  const { data: ss } = await sb.from('sync_status').select('location_id, last_synced_at')
  const lastByLoc = new Map<string, number>()
  for (const s of ss ?? []) {
    const t = s.last_synced_at ? new Date(s.last_synced_at).getTime() : 0
    if (t > (lastByLoc.get(s.location_id) ?? 0)) lastByLoc.set(s.location_id, t)
  }
  const ordered = [...connections].sort((a, b) => (lastByLoc.get(a.location_id) ?? 0) - (lastByLoc.get(b.location_id) ?? 0))

  const results: Record<string, unknown> = {}
  let skipped = 0

  // Sequential (to respect GHL rate limits) with a time budget.
  for (const conn of ordered) {
    if (Date.now() - started > BUDGET_MS) { skipped++; continue }
    try {
      results[conn.location_id] = await bulkSyncLocation(conn.location_id)
    } catch (err) {
      results[conn.location_id] = { error: err instanceof Error ? err.message : String(err) }
    }
  }
  if (skipped > 0) console.warn(`[cron/sync-ghl-cache] time budget hit — ${skipped} locations deferred to next run`)

  // Also sync GHL users → Supabase profiles (only if budget remains).
  let userSyncResult: unknown = { skipped: 'time budget' }
  if (Date.now() - started <= BUDGET_MS) {
    try {
      userSyncResult = await syncAllLocationUsers()
      console.log('[cron/sync-ghl-cache] user sync:', userSyncResult)
    } catch (err) {
      userSyncResult = { error: err instanceof Error ? err.message : String(err) }
    }
  }

  console.log('[cron/sync-ghl-cache] completed:', Object.keys(results).length, 'synced,', skipped, 'deferred')
  return NextResponse.json({ synced: Object.keys(results).length, skipped, results, userSync: userSyncResult })
}
