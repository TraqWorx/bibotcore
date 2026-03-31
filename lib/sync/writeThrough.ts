/**
 * Write-through helpers — after a successful GHL write, update the Supabase cache.
 *
 * Pattern: server action writes to GHL → on success → call these to keep cache fresh.
 * If the cache update fails, we log but don't throw — the webhook will catch up.
 */

import { createAdminClient } from '@/lib/supabase-server'
import {
  transformContact,
  transformContactCustomFields,
  transformOpportunity,
  transformConversation,
} from './transforms'

// ── Contacts ─────────────────────────────────────────────────

/** Upsert a contact into the cache after a successful GHL create/update */
export async function writeThroughContact(
  locationId: string,
  contactData: Record<string, unknown>,
) {
  try {
    const contactId = contactData.id as string
    if (!contactId) return

    const sb = createAdminClient()
    const row = transformContact(locationId, contactData)
    await sb.from('cached_contacts').upsert(row as never, { onConflict: 'location_id,ghl_id' })

    // Update custom fields if present
    const customFields = contactData.customFields ?? contactData.custom_fields
    if (Array.isArray(customFields)) {
      await sb.from('cached_contact_custom_fields').delete()
        .eq('location_id', locationId).eq('contact_ghl_id', contactId)
      const cfRows = transformContactCustomFields(locationId, contactId, customFields)
      if (cfRows.length > 0) {
        await sb.from('cached_contact_custom_fields').upsert(
          cfRows as never[],
          { onConflict: 'location_id,contact_ghl_id,field_id' },
        )
      }
    }
  } catch (err) {
    console.error('[writeThrough] contact cache update failed:', err)
  }
}

/** Remove a contact from the cache after a successful GHL delete */
export async function writeThroughContactDelete(
  locationId: string,
  contactGhlId: string,
) {
  try {
    const sb = createAdminClient()
    await sb.from('cached_contact_custom_fields').delete()
      .eq('location_id', locationId).eq('contact_ghl_id', contactGhlId)
    await sb.from('cached_contacts').delete()
      .eq('location_id', locationId).eq('ghl_id', contactGhlId)
  } catch (err) {
    console.error('[writeThrough] contact delete cache update failed:', err)
  }
}

// ── Opportunities ────────────────────────────────────────────

/** Upsert an opportunity into the cache */
export async function writeThroughOpportunity(
  locationId: string,
  oppData: Record<string, unknown>,
) {
  try {
    const oppId = oppData.id as string
    if (!oppId) return

    const sb = createAdminClient()
    const row = transformOpportunity(locationId, oppData)
    await sb.from('cached_opportunities').upsert(row as never, { onConflict: 'location_id,ghl_id' })
  } catch (err) {
    console.error('[writeThrough] opportunity cache update failed:', err)
  }
}

/** Remove an opportunity from the cache */
export async function writeThroughOpportunityDelete(
  locationId: string,
  oppGhlId: string,
) {
  try {
    const sb = createAdminClient()
    await sb.from('cached_opportunities').delete()
      .eq('location_id', locationId).eq('ghl_id', oppGhlId)
  } catch (err) {
    console.error('[writeThrough] opportunity delete cache update failed:', err)
  }
}

// ── Conversations ────────────────────────────────────────────

/** Upsert a conversation into the cache (e.g. after sending a message) */
export async function writeThroughConversation(
  locationId: string,
  convoData: Record<string, unknown>,
) {
  try {
    const convoId = convoData.id as string
    if (!convoId) return

    const sb = createAdminClient()
    const row = transformConversation(locationId, convoData)
    await sb.from('cached_conversations').upsert(row as never, { onConflict: 'location_id,ghl_id' })
  } catch (err) {
    console.error('[writeThrough] conversation cache update failed:', err)
  }
}

// ── Notes ────────────────────────────────────────────────────

/** Upsert a note into the cache */
export async function writeThroughNote(
  locationId: string,
  contactGhlId: string,
  noteData: Record<string, unknown>,
) {
  try {
    const noteId = noteData.id as string
    if (!noteId) return

    const sb = createAdminClient()
    await sb.from('cached_notes').upsert(
      {
        ghl_id: noteId,
        location_id: locationId,
        contact_ghl_id: contactGhlId,
        body: (noteData.body as string) ?? null,
        date_added: (noteData.dateAdded as string) ?? new Date().toISOString(),
        created_by: (noteData.userId as string) ?? null,
        synced_at: new Date().toISOString(),
      } as never,
      { onConflict: 'location_id,ghl_id' },
    )
  } catch (err) {
    console.error('[writeThrough] note cache update failed:', err)
  }
}

/** Remove a note from the cache */
export async function writeThroughNoteDelete(
  locationId: string,
  noteGhlId: string,
) {
  try {
    const sb = createAdminClient()
    await sb.from('cached_notes').delete()
      .eq('location_id', locationId).eq('ghl_id', noteGhlId)
  } catch (err) {
    console.error('[writeThrough] note delete cache update failed:', err)
  }
}

// ── Tasks ────────────────────────────────────────────────────

/** Upsert a task into the cache */
export async function writeThroughTask(
  locationId: string,
  contactGhlId: string,
  taskData: Record<string, unknown>,
) {
  try {
    const taskId = taskData.id as string
    if (!taskId) return

    const sb = createAdminClient()
    await sb.from('cached_tasks').upsert(
      {
        ghl_id: taskId,
        location_id: locationId,
        contact_ghl_id: contactGhlId,
        title: (taskData.title as string) ?? null,
        due_date: (taskData.dueDate as string) ?? null,
        completed: taskData.completed === true,
        synced_at: new Date().toISOString(),
      } as never,
      { onConflict: 'location_id,ghl_id' },
    )
  } catch (err) {
    console.error('[writeThrough] task cache update failed:', err)
  }
}
