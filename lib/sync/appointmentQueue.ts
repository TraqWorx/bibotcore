/**
 * Appointment queue — creates appointments in Supabase first,
 * then syncs to GHL asynchronously. Retries on failure.
 */

import { createAdminClient } from '@/lib/supabase-server'
import { getGhlClient } from '@/lib/ghl/ghlClient'

interface CreateAppointmentInput {
  locationId: string
  calendarId: string
  contactGhlId?: string
  title?: string
  startTime: string
  endTime: string
  createdBy?: string
}

/**
 * Queue an appointment — saved immediately in Supabase,
 * then synced to GHL. Returns the queue record ID.
 */
export async function queueAppointment(input: CreateAppointmentInput): Promise<{
  queueId: string
  ghlEventId?: string
  error?: string
}> {
  const sb = createAdminClient()

  // 1. Insert into queue (instant — user sees it immediately)
  const { data: queued, error: insertErr } = await sb
    .from('appointment_queue')
    .insert({
      location_id: input.locationId,
      calendar_id: input.calendarId,
      contact_ghl_id: input.contactGhlId ?? null,
      title: input.title ?? null,
      start_time: input.startTime,
      end_time: input.endTime,
      created_by: input.createdBy ?? null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr || !queued) {
    return { queueId: '', error: insertErr?.message ?? 'Failed to queue appointment' }
  }

  // 2. Also insert into cached_calendar_events for immediate display
  const tempId = `pending-${queued.id}`
  await sb.from('cached_calendar_events').upsert({
    ghl_id: tempId,
    location_id: input.locationId,
    calendar_id: input.calendarId,
    contact_ghl_id: input.contactGhlId ?? null,
    title: input.title ?? null,
    start_time: input.startTime,
    end_time: input.endTime,
    appointment_status: 'pending',
    synced_at: new Date().toISOString(),
  }, { onConflict: 'location_id,ghl_id' })

  // 3. Try to sync to GHL immediately
  try {
    const ghl = await getGhlClient(input.locationId)
    const result = await ghl.calendarEvents.create({
      title: input.title,
      startTime: input.startTime,
      endTime: input.endTime,
      calendarId: input.calendarId,
      contactId: input.contactGhlId,
    })

    const ghlEventId = result?.id ?? result?.event?.id
    if (ghlEventId) {
      // Update queue with GHL ID
      await sb.from('appointment_queue').update({
        status: 'synced',
        ghl_event_id: ghlEventId,
        updated_at: new Date().toISOString(),
      }).eq('id', queued.id)

      // Replace temp cached event with real GHL event
      await sb.from('cached_calendar_events').delete()
        .eq('location_id', input.locationId).eq('ghl_id', tempId)
      await sb.from('cached_calendar_events').upsert({
        ghl_id: ghlEventId,
        location_id: input.locationId,
        calendar_id: input.calendarId,
        contact_ghl_id: input.contactGhlId ?? null,
        title: input.title ?? null,
        start_time: input.startTime,
        end_time: input.endTime,
        appointment_status: 'confirmed',
        synced_at: new Date().toISOString(),
      }, { onConflict: 'location_id,ghl_id' })

      return { queueId: queued.id, ghlEventId }
    }
  } catch (err) {
    // GHL failed — mark for retry
    await sb.from('appointment_queue').update({
      status: 'pending',
      error: err instanceof Error ? err.message : String(err),
      attempts: 1,
      updated_at: new Date().toISOString(),
    }).eq('id', queued.id)
  }

  return { queueId: queued.id }
}

/**
 * Process pending appointments in the queue — called by cron job.
 */
export async function processAppointmentQueue(locationId?: string): Promise<{
  processed: number
  failed: number
}> {
  const sb = createAdminClient()

  let query = sb
    .from('appointment_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('attempts', 5)
    .order('created_at')
    .limit(50)

  if (locationId) query = query.eq('location_id', locationId)

  const { data: pending } = await query
  if (!pending || pending.length === 0) return { processed: 0, failed: 0 }

  let processed = 0
  let failed = 0

  for (const item of pending) {
    try {
      const ghl = await getGhlClient(item.location_id)
      const result = await ghl.calendarEvents.create({
        title: item.title,
        startTime: item.start_time,
        endTime: item.end_time,
        calendarId: item.calendar_id,
        contactId: item.contact_ghl_id,
      })

      const ghlEventId = result?.id ?? result?.event?.id
      await sb.from('appointment_queue').update({
        status: 'synced',
        ghl_event_id: ghlEventId ?? null,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id)

      // Update cached event
      const tempId = `pending-${item.id}`
      await sb.from('cached_calendar_events').delete()
        .eq('location_id', item.location_id).eq('ghl_id', tempId)
      if (ghlEventId) {
        await sb.from('cached_calendar_events').upsert({
          ghl_id: ghlEventId,
          location_id: item.location_id,
          calendar_id: item.calendar_id,
          contact_ghl_id: item.contact_ghl_id,
          title: item.title,
          start_time: item.start_time,
          end_time: item.end_time,
          appointment_status: 'confirmed',
          synced_at: new Date().toISOString(),
        }, { onConflict: 'location_id,ghl_id' })
      }

      processed++
    } catch (err) {
      await sb.from('appointment_queue').update({
        attempts: item.attempts + 1,
        error: err instanceof Error ? err.message : String(err),
        status: item.attempts + 1 >= 5 ? 'failed' : 'pending',
        updated_at: new Date().toISOString(),
      }).eq('id', item.id)
      failed++
    }
  }

  return { processed, failed }
}
