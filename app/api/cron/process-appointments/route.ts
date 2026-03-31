import { NextResponse } from 'next/server'
import { processAppointmentQueue } from '@/lib/sync/appointmentQueue'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron: process pending appointments every 5 minutes.
 * Retries appointments that failed to sync to GHL.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processAppointmentQueue()
    console.log('[cron/process-appointments]', result)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron/process-appointments] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
