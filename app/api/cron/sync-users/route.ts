import { NextResponse } from 'next/server'
import { syncAllLocationUsers } from '@/lib/sync/syncAllUsers'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Cron: sync GHL users into Supabase every 15 minutes.
 * Detects new users added in GHL and removes deleted ones.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncAllLocationUsers()
    console.log('[cron/sync-users]', result)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron/sync-users] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
