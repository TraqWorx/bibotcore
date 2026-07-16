import { NextRequest, NextResponse } from 'next/server'
import { processAppointmentQueue } from '@/lib/sync/appointmentQueue'
import { processBulkJobGhlSync } from '@/lib/sync/bulkActions'
import { isCronAuthorized } from '@/lib/auth/cronAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron: process pending appointments every 5 minutes.
 * Retries appointments that failed to sync to GHL.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [appointmentResult, bulkResult] = await Promise.all([
      processAppointmentQueue(),
      processBulkJobGhlSync(),
    ])
    console.log('[cron/process-appointments]', appointmentResult, bulkResult)
    return NextResponse.json({ appointments: appointmentResult, bulkJobs: bulkResult })
  } catch (err) {
    console.error('[cron/process-appointments] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
