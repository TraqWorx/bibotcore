import { NextResponse } from 'next/server'
import { promoteExpiredHolds, reconcileWaitlistBookings } from '@/lib/bellessere/waitlistActions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron: expire waiting-list invites whose hold window elapsed and drip the freed
 * slot to the next matching person. Runs hourly (see vercel.json).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const booked = await reconcileWaitlistBookings()
    const result = await promoteExpiredHolds()
    console.log('[cron/bellessere-waitlist]', { booked, ...result })
    return NextResponse.json({ ok: true, booked, ...result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
