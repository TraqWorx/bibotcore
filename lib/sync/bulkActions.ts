/**
 * Bulk action queue — creates jobs that process contacts in batches.
 * DB updates happen immediately, GHL sync in background.
 */

import { createAdminClient } from '@/lib/supabase-server'
import { getGhlClient } from '@/lib/ghl/ghlClient'

const BATCH_SIZE = 50

interface BulkActionInput {
  locationId: string
  userId?: string
  action: 'add_tag' | 'remove_tag' | 'update_field'
  description: string
  contactGhlIds: string[]
  params: Record<string, string>
}

/** Create a bulk action job and start processing immediately on DB, queue GHL sync */
export async function createBulkJob(input: BulkActionInput): Promise<{
  jobId: string
  total: number
}> {
  const sb = createAdminClient()

  // Create the job
  const { data: job } = await sb.from('bulk_action_jobs').insert({
    location_id: input.locationId,
    created_by: input.userId ?? null,
    action: input.action,
    description: input.description,
    filters: {},
    params: input.params,
    total_contacts: input.contactGhlIds.length,
    processed: 0,
    failed: 0,
    status: 'running',
    started_at: new Date().toISOString(),
  }).select('id').single()

  const jobId = job?.id ?? ''

  // Update Supabase cache immediately (fast — no GHL API calls)
  let processed = 0
  let failed = 0

  for (let i = 0; i < input.contactGhlIds.length; i += BATCH_SIZE) {
    const batch = input.contactGhlIds.slice(i, i + BATCH_SIZE)

    for (const contactId of batch) {
      try {
        switch (input.action) {
          case 'add_tag': {
            const { data: contact } = await sb.from('cached_contacts')
              .select('tags').eq('location_id', input.locationId).eq('ghl_id', contactId).single()
            const currentTags: string[] = contact?.tags ?? []
            if (!currentTags.includes(input.params.tag)) {
              await sb.from('cached_contacts').update({ tags: [...currentTags, input.params.tag] })
                .eq('location_id', input.locationId).eq('ghl_id', contactId)
            }
            break
          }
          case 'remove_tag': {
            const { data: contact } = await sb.from('cached_contacts')
              .select('tags').eq('location_id', input.locationId).eq('ghl_id', contactId).single()
            const currentTags: string[] = contact?.tags ?? []
            const newTags = currentTags.filter((t) => t.toLowerCase() !== input.params.tag.toLowerCase())
            if (newTags.length !== currentTags.length) {
              await sb.from('cached_contacts').update({ tags: newTags })
                .eq('location_id', input.locationId).eq('ghl_id', contactId)
            }
            break
          }
          case 'update_field': {
            await sb.from('cached_contact_custom_fields').upsert({
              location_id: input.locationId,
              contact_ghl_id: contactId,
              field_id: input.params.fieldId,
              value: input.params.value,
            } as never, { onConflict: 'location_id,contact_ghl_id,field_id' })
            break
          }
        }
        processed++
      } catch {
        failed++
      }
    }

    // Update progress
    await sb.from('bulk_action_jobs').update({ processed, failed }).eq('id', jobId)
  }

  // Mark DB update complete — GHL sync happens via cron
  await sb.from('bulk_action_jobs').update({
    processed,
    failed,
    status: 'syncing',
    completed_at: new Date().toISOString(),
  }).eq('id', jobId)

  return { jobId, total: input.contactGhlIds.length }
}

/** Process pending GHL syncs for bulk jobs — called by cron */
export async function processBulkJobGhlSync(): Promise<{ processed: number }> {
  const sb = createAdminClient()

  const { data: jobs } = await sb.from('bulk_action_jobs')
    .select('*')
    .eq('status', 'syncing')
    .order('created_at')
    .limit(5)

  if (!jobs || jobs.length === 0) return { processed: 0 }

  let totalProcessed = 0

  for (const job of jobs) {
    try {
      const ghl = await getGhlClient(job.location_id)

      // Get all contacts that were updated
      const { data: contacts } = await sb.from('cached_contacts')
        .select('ghl_id, tags')
        .eq('location_id', job.location_id)
        .limit(10000)

      const params = job.params as Record<string, string>
      let synced = 0

      for (const contact of contacts ?? []) {
        try {
          switch (job.action) {
            case 'add_tag':
            case 'remove_tag': {
              // Push current tags to GHL
              await ghl.contacts.update(contact.ghl_id, { tags: contact.tags })
              break
            }
            case 'update_field': {
              const { data: cfRow } = await sb.from('cached_contact_custom_fields')
                .select('value')
                .eq('location_id', job.location_id)
                .eq('contact_ghl_id', contact.ghl_id)
                .eq('field_id', params.fieldId)
                .maybeSingle()
              if (cfRow) {
                await ghl.contacts.update(contact.ghl_id, {
                  customFields: [{ id: params.fieldId, field_value: cfRow.value }],
                })
              }
              break
            }
          }
          synced++
        } catch {
          // GHL rate limit or error — will retry next cron run
        }

        // Rate limit: 2 per second
        if (synced % 2 === 0) await new Promise((r) => setTimeout(r, 500))
      }

      await sb.from('bulk_action_jobs').update({
        status: synced === (contacts ?? []).length ? 'completed' : 'syncing',
      }).eq('id', job.id)

      totalProcessed += synced
    } catch (err) {
      await sb.from('bulk_action_jobs').update({
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      }).eq('id', job.id)
    }
  }

  return { processed: totalProcessed }
}

/** Get jobs for a location */
export async function getBulkJobs(locationId: string) {
  const sb = createAdminClient()
  const { data } = await sb.from('bulk_action_jobs')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(20)
  return data ?? []
}
