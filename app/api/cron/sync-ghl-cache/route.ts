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

  // Get all active locations with GHL connections
  const { data: connections } = await sb
    .from('ghl_connections')
    .select('location_id')
    .not('access_token', 'is', null)

  if (!connections || connections.length === 0) {
    return NextResponse.json({ message: 'No active locations', synced: 0 })
  }

  const results: Record<string, unknown> = {}

  // Sync locations sequentially to avoid overwhelming GHL API
  for (const conn of connections) {
    try {
      results[conn.location_id] = await bulkSyncLocation(conn.location_id)
    } catch (err) {
      results[conn.location_id] = { error: err instanceof Error ? err.message : String(err) }
    }
  }

  // Also sync GHL users → Supabase profiles + profile_locations
  let userSyncResult: unknown = null
  try {
    userSyncResult = await syncAllLocationUsers()
    console.log('[cron/sync-ghl-cache] user sync:', userSyncResult)
  } catch (err) {
    userSyncResult = { error: err instanceof Error ? err.message : String(err) }
  }

  console.log('[cron/sync-ghl-cache] completed:', Object.keys(results).length, 'locations')
  return NextResponse.json({ synced: Object.keys(results).length, results, userSync: userSyncResult })
}
