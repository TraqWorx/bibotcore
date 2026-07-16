import { NextRequest, NextResponse } from 'next/server'
import { syncSubscriptionsCore } from '@/lib/syncSubscriptions'
import { isCronAuthorized } from '@/lib/auth/cronAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncSubscriptionsCore()
    console.log('[cron/sync-subscriptions]', result)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron/sync-subscriptions] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to sync' },
      { status: 500 }
    )
  }
}
