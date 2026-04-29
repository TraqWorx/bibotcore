import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'

/**
 * Cron endpoint: processes active drip jobs.
 * Call this every minute via Vercel cron or external scheduler.
 * Protected by CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createAdminClient()

  // Get active drip jobs that are due for next batch
  const { data: jobs } = await sb
    .from('drip_jobs')
    .select('*')
    .eq('status', 'active')

  if (!jobs?.length) return NextResponse.json({ processed: 0 })

  let totalSent = 0

  for (const job of jobs) {
    const now = new Date()

    // Skip if start_at is set and is in the future
    if (job.start_at && new Date(job.start_at).getTime() > now.getTime()) continue

    const lastBatch = job.last_batch_at ? new Date(job.last_batch_at) : null
    const intervalMs = (job.interval_minutes ?? 60) * 60 * 1000

    // Skip if not enough time has passed since last batch
    if (lastBatch && now.getTime() - lastBatch.getTime() < intervalMs) continue

    const contactIds: string[] = job.contact_ids ?? []
    const sentCount: number = job.sent_count ?? 0
    const remaining = contactIds.slice(sentCount)

    if (remaining.length === 0) {
      await sb.from('drip_jobs').update({ status: 'completed' }).eq('id', job.id)
      continue
    }

    const batch = remaining.slice(0, job.batch_size ?? 10)
    let batchSent = 0

    try {
      const token = await getGhlTokenForLocation(job.location_id)

      for (const contactId of batch) {
        try {
          // Find conversation
          const searchRes = await fetch(
            `https://services.leadconnectorhq.com/conversations/search?contactId=${contactId}`,
            { headers: { Authorization: `Bearer ${token}`, Version: '2021-04-15' } }
          )
          let conversationId: string | null = null
          if (searchRes.ok) {
            const data = await searchRes.json()
            conversationId = data?.conversations?.[0]?.id ?? null
          }

          if (!conversationId) {
            // Create conversation
            const createRes = await fetch('https://services.leadconnectorhq.com/conversations/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Version: '2021-04-15' },
              body: JSON.stringify({ locationId: job.location_id, contactId }),
            })
            if (createRes.ok) {
              const created = await createRes.json()
              conversationId = created?.conversation?.id ?? null
            }
          }

          if (!conversationId) continue

          const payload: Record<string, unknown> = {
            type: job.type ?? 'SMS',
            contactId,
            conversationId,
            message: job.message,
          }
          if (job.image_url) payload.attachments = [job.image_url]

          await fetch('https://services.leadconnectorhq.com/conversations/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Version: '2021-04-15' },
            body: JSON.stringify(payload),
          })

          batchSent++
        } catch (err) {
          console.error(`[drip] failed to send to ${contactId}:`, err)
        }
      }
    } catch (err) {
      console.error(`[drip] job ${job.id} token error:`, err)
      await sb.from('drip_jobs').update({ status: 'failed' }).eq('id', job.id)
      continue
    }

    const newSentCount = sentCount + batchSent
    const isComplete = newSentCount >= contactIds.length

    await sb.from('drip_jobs').update({
      sent_count: newSentCount,
      last_batch_at: now.toISOString(),
      status: isComplete ? 'completed' : 'active',
    }).eq('id', job.id)

    totalSent += batchSent
  }

  return NextResponse.json({ processed: totalSent })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
