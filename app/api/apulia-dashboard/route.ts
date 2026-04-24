import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getGhlClient } from '@/lib/ghl/ghlClient'

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) return NextResponse.json({ error: 'Missing locationId' }, { status: 400 })

  const sb = createAdminClient()

  // Parallel fetch: contacts count, conversations, drip jobs
  const [contactsData, conversationsData, dripJobsResult] = await Promise.all([
    getGhlClient(locationId)
      .then((ghl) => ghl.contacts.list())
      .catch(() => null),
    getGhlClient(locationId)
      .then((ghl) => ghl.conversations.search())
      .catch(() => null),
    sb.from('drip_jobs')
      .select('*')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // Contacts
  const contacts = (contactsData?.contacts ?? []) as { id: string }[]
  const totalContacts = contactsData?.meta?.total ?? contactsData?.total ?? contacts.length ?? 0

  // Conversations — count unreplied (last message direction = inbound)
  const conversations = (conversationsData?.conversations ?? []) as {
    id: string
    lastMessageDirection?: string
    lastMessageDate?: string
    lastMessageBody?: string
    contactName?: string
    unreadCount?: number
  }[]
  const unreplied = conversations.filter(
    (c) => c.lastMessageDirection === 'inbound'
  )

  // Drip jobs
  const dripJobs = (dripJobsResult.data ?? []) as {
    id: string
    type: string
    message: string
    contact_ids: string[]
    batch_size: number
    interval_minutes: number
    sent_count: number
    status: string
    last_batch_at: string | null
    created_at: string
  }[]

  const activeJobs = dripJobs.filter((j) => j.status === 'active')
  const completedJobs = dripJobs.filter((j) => j.status === 'completed')

  // Calculate totals
  let totalSent = 0
  let totalPending = 0
  for (const job of dripJobs) {
    const total = (job.contact_ids ?? []).length
    totalSent += job.sent_count ?? 0
    if (job.status === 'active') {
      totalPending += total - (job.sent_count ?? 0)
    }
  }

  // Next batch info
  let nextBatch: { jobId: string; scheduledAt: string; batchSize: number; remaining: number } | null = null
  for (const job of activeJobs) {
    const total = (job.contact_ids ?? []).length
    const remaining = total - (job.sent_count ?? 0)
    if (remaining > 0) {
      const lastBatch = job.last_batch_at ? new Date(job.last_batch_at) : new Date(job.created_at)
      const nextAt = new Date(lastBatch.getTime() + (job.interval_minutes ?? 60) * 60 * 1000)
      if (!nextBatch || nextAt < new Date(nextBatch.scheduledAt)) {
        nextBatch = {
          jobId: job.id,
          scheduledAt: nextAt.toISOString(),
          batchSize: Math.min(job.batch_size ?? 10, remaining),
          remaining,
        }
      }
    }
  }

  return NextResponse.json({
    totalContacts,
    unrepliedCount: unreplied.length,
    unrepliedConversations: unreplied.slice(0, 5).map((c) => ({
      id: c.id,
      contactName: c.contactName ?? 'Unknown',
      lastMessage: c.lastMessageBody ?? '',
      lastMessageDate: c.lastMessageDate ?? '',
    })),
    campaigns: {
      total: dripJobs.length,
      active: activeJobs.length,
      completed: completedJobs.length,
      totalSent,
      totalPending,
    },
    recentCampaigns: dripJobs.slice(0, 5).map((j) => ({
      id: j.id,
      type: j.type,
      message: j.message.slice(0, 80),
      status: j.status,
      total: (j.contact_ids ?? []).length,
      sent: j.sent_count ?? 0,
      createdAt: j.created_at,
    })),
    nextBatch,
  })
}
