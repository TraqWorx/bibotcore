import { NextResponse } from 'next/server'
import { syncSubscriptionsCore } from '@/lib/syncSubscriptions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
