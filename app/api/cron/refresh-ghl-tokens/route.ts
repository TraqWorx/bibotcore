import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { refreshGhlToken } from '@/lib/ghl/refreshGhlToken'

export const dynamic = 'force-dynamic'

// Refresh proactively when expires_at is within this window (24h).
const REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000

interface RefreshResult {
  location_id: string
  status: 'refreshed' | 'skipped' | 'failed'
  error?: string
  expires_at?: string
}

async function run(): Promise<{ results: RefreshResult[]; refreshed: number; failed: number; skipped: number }> {
  const sb = createAdminClient()
  const { data: connections, error } = await sb
    .from('ghl_connections')
    .select('location_id, access_token, refresh_token, expires_at')
    .not('refresh_token', 'is', null)

  if (error) throw new Error(`load connections: ${error.message}`)

  const results: RefreshResult[] = []
  const now = Date.now()

  for (const conn of connections ?? []) {
    const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : 0
    const dueForRefresh = !conn.expires_at || expiresAt - now <= REFRESH_WINDOW_MS

    if (!dueForRefresh) {
      results.push({ location_id: conn.location_id, status: 'skipped', expires_at: conn.expires_at ?? undefined })
      continue
    }

    try {
      await refreshGhlToken(conn.location_id, conn.refresh_token!)
      results.push({ location_id: conn.location_id, status: 'refreshed' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[refresh-ghl-tokens] ${conn.location_id} failed:`, msg)
      results.push({ location_id: conn.location_id, status: 'failed', error: msg })
    }
  }

  const refreshed = results.filter((r) => r.status === 'refreshed').length
  const failed = results.filter((r) => r.status === 'failed').length
  const skipped = results.filter((r) => r.status === 'skipped').length

  return { results, refreshed, failed, skipped }
}

function authorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const secret = req.headers.get('authorization')?.replace('Bearer ', '') ?? req.nextUrl.searchParams.get('secret')
  return Boolean(process.env.CRON_SECRET) && secret === process.env.CRON_SECRET
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const summary = await run()
    return NextResponse.json(summary)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
