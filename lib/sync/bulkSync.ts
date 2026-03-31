/**
 * Bulk sync engine — imports GHL data into Supabase cache tables.
 *
 * Each entity syncer paginates through the GHL API and upserts into
 * the corresponding cached_* table in batches.
 *
 * Usage:
 *   await bulkSyncLocation(locationId)            // sync everything
 *   await bulkSyncLocation(locationId, ['contacts']) // sync one entity
 */

import { createAdminClient } from '@/lib/supabase-server'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'
import {
  transformContact,
  transformContactCustomFields,
  transformOpportunity,
  transformPipeline,
  transformConversation,
  transformCustomFieldDef,
} from './transforms'

const GHL_BASE = 'https://services.leadconnectorhq.com'
const BATCH_SIZE = 500

type EntityType = 'contacts' | 'opportunities' | 'pipelines' | 'conversations' | 'custom_fields' | 'tags' | 'calendars' | 'calendar_events' | 'notes' | 'tasks' | 'users'
const ALL_ENTITIES: EntityType[] = [
  'custom_fields', 'tags', 'users', 'contacts', 'opportunities',
  'pipelines', 'conversations', 'calendars', 'calendar_events',
  'notes', 'tasks',
]

// ── Helpers ──────────────────────────────────────────────────

async function ghlFetch(path: string, token: string, options?: RequestInit) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Version: '2021-07-28',
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GHL ${res.status}: ${text}`)
  }
  return res.json()
}

async function setSyncStatus(
  locationId: string,
  entityType: string,
  status: string,
  error?: string | null,
  cursor?: string | null,
) {
  const sb = createAdminClient()
  await sb.from('sync_status').upsert(
    {
      location_id: locationId,
      entity_type: entityType,
      status,
      last_synced_at: status === 'completed' ? new Date().toISOString() : undefined,
      error: error ?? null,
      cursor: cursor ?? null,
    },
    { onConflict: 'location_id,entity_type' },
  )
}

/** Upsert rows in batches to avoid hitting Supabase payload limits */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertBatch(
  table: string,
  rows: any[],
  onConflict: string,
) {
  if (rows.length === 0) return
  const sb = createAdminClient()
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await sb.from(table).upsert(batch, { onConflict })
    if (error) throw new Error(`Upsert ${table}: ${error.message}`)
  }
}

// ── Entity Syncers ───────────────────────────────────────────

async function syncContacts(locationId: string, token: string) {
  await setSyncStatus(locationId, 'contacts', 'running')
  try {
    const allContacts: Record<string, unknown>[] = []

    // Paginate through POST /contacts/search (max 100 per page)
    for (let page = 1; page <= 200; page++) {
      const data = await ghlFetch('/contacts/search', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, pageLimit: 100, page }),
      })
      const contacts = data?.contacts ?? []
      allContacts.push(...contacts)

      // Save cursor in case we need to resume
      if (page % 10 === 0) {
        await setSyncStatus(locationId, 'contacts', 'running', null, String(page))
      }

      if (contacts.length < 100) break
    }

    // Transform and upsert contacts
    const contactRows = allContacts.map((c) => transformContact(locationId, c))
    await upsertBatch('cached_contacts', contactRows, 'location_id,ghl_id')

    // Transform and upsert custom field values
    const cfRows = allContacts.flatMap((c) =>
      transformContactCustomFields(
        locationId,
        c.id as string,
        (c.customFields ?? []) as Array<Record<string, unknown>>,
      ),
    )
    // Delete existing custom fields for this location first (clean slate per sync)
    const sb = createAdminClient()
    await sb.from('cached_contact_custom_fields').delete().eq('location_id', locationId)
    await upsertBatch('cached_contact_custom_fields', cfRows, 'location_id,contact_ghl_id,field_id')

    // Remove contacts from cache that no longer exist in GHL
    const ghlIds = new Set(allContacts.map((c) => c.id as string))
    const { data: cachedIds } = await sb
      .from('cached_contacts')
      .select('ghl_id')
      .eq('location_id', locationId)
    if (cachedIds) {
      const staleIds = cachedIds
        .map((r) => r.ghl_id)
        .filter((id) => !ghlIds.has(id))
      if (staleIds.length > 0) {
        await sb
          .from('cached_contacts')
          .delete()
          .eq('location_id', locationId)
          .in('ghl_id', staleIds)
      }
    }

    await setSyncStatus(locationId, 'contacts', 'completed')
    return { count: allContacts.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await setSyncStatus(locationId, 'contacts', 'failed', msg)
    throw err
  }
}

async function syncOpportunities(locationId: string, _token: string) {
  await setSyncStatus(locationId, 'opportunities', 'running')
  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.opportunities.list()
    const opps: Record<string, unknown>[] = data?.opportunities ?? []

    const rows = opps.map((o) => transformOpportunity(locationId, o))
    await upsertBatch('cached_opportunities', rows, 'location_id,ghl_id')

    // Remove stale
    const sb = createAdminClient()
    const ghlIds = new Set(opps.map((o) => o.id as string))
    const { data: cachedIds } = await sb
      .from('cached_opportunities')
      .select('ghl_id')
      .eq('location_id', locationId)
    if (cachedIds) {
      const staleIds = cachedIds.map((r) => r.ghl_id).filter((id) => !ghlIds.has(id))
      if (staleIds.length > 0) {
        await sb.from('cached_opportunities').delete().eq('location_id', locationId).in('ghl_id', staleIds)
      }
    }

    await setSyncStatus(locationId, 'opportunities', 'completed')
    return { count: opps.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await setSyncStatus(locationId, 'opportunities', 'failed', msg)
    throw err
  }
}

async function syncPipelines(locationId: string, _token: string) {
  await setSyncStatus(locationId, 'pipelines', 'running')
  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.pipelines.list()
    const pipelines: Record<string, unknown>[] = data?.pipelines ?? []

    const rows = pipelines.map((p) => transformPipeline(locationId, p))
    await upsertBatch('cached_pipelines', rows, 'location_id,ghl_id')

    await setSyncStatus(locationId, 'pipelines', 'completed')
    return { count: pipelines.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await setSyncStatus(locationId, 'pipelines', 'failed', msg)
    throw err
  }
}

async function syncConversations(locationId: string, _token: string) {
  await setSyncStatus(locationId, 'conversations', 'running')
  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.conversations.search('status=all&limit=100&sort=desc&sortBy=last_message_date')
    const convos: Record<string, unknown>[] = data?.conversations ?? []

    const rows = convos.map((c) => transformConversation(locationId, c))
    await upsertBatch('cached_conversations', rows, 'location_id,ghl_id')

    await setSyncStatus(locationId, 'conversations', 'completed')
    return { count: convos.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await setSyncStatus(locationId, 'conversations', 'failed', msg)
    throw err
  }
}

async function syncCustomFields(locationId: string, token: string) {
  await setSyncStatus(locationId, 'custom_fields', 'running')
  try {
    const data = await ghlFetch(`/locations/${locationId}/customFields`, token)
    const fields: Record<string, unknown>[] = data?.customFields ?? []

    const rows = fields.map((f) => transformCustomFieldDef(locationId, f))
    await upsertBatch('cached_custom_fields', rows, 'location_id,field_id')

    await setSyncStatus(locationId, 'custom_fields', 'completed')
    return { count: fields.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await setSyncStatus(locationId, 'custom_fields', 'failed', msg)
    throw err
  }
}

// ── Tags ─────────────────────────────────────────────────────

async function syncTags(locationId: string, _token: string) {
  await setSyncStatus(locationId, 'tags', 'running')
  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.tags.list()
    const tags: Record<string, unknown>[] = data?.tags ?? []

    const rows = tags.map((t) => ({
      ghl_id: t.id as string,
      location_id: locationId,
      name: (t.name as string) ?? '',
      synced_at: new Date().toISOString(),
    }))
    await upsertBatch('cached_tags', rows, 'location_id,ghl_id')

    await setSyncStatus(locationId, 'tags', 'completed')
    return { count: tags.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await setSyncStatus(locationId, 'tags', 'failed', msg)
    throw err
  }
}

// ── GHL Users ────────────────────────────────────────────────

async function syncUsers(locationId: string, token: string) {
  await setSyncStatus(locationId, 'users', 'running')
  try {
    const data = await ghlFetch(`/users/?locationId=${locationId}`, token)
    const users: Record<string, unknown>[] = data?.users ?? []

    const rows = users.map((u) => ({
      ghl_id: u.id as string,
      location_id: locationId,
      name: (u.name as string) ?? null,
      first_name: (u.firstName as string) ?? null,
      last_name: (u.lastName as string) ?? null,
      email: (u.email as string) ?? null,
      role: ((u.roles as Record<string, unknown>)?.role as string) ?? null,
      synced_at: new Date().toISOString(),
    }))
    await upsertBatch('cached_ghl_users', rows, 'location_id,ghl_id')

    await setSyncStatus(locationId, 'users', 'completed')
    return { count: users.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await setSyncStatus(locationId, 'users', 'failed', msg)
    throw err
  }
}

// ── Calendars & Events ───────────────────────────────────────

async function syncCalendars(locationId: string, _token: string) {
  await setSyncStatus(locationId, 'calendars', 'running')
  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.calendars.list()
    const calendars: Record<string, unknown>[] = data?.calendars ?? []

    const rows = calendars.map((c) => ({
      ghl_id: c.id as string,
      location_id: locationId,
      name: (c.name as string) ?? null,
      synced_at: new Date().toISOString(),
    }))
    await upsertBatch('cached_calendars', rows, 'location_id,ghl_id')

    await setSyncStatus(locationId, 'calendars', 'completed')
    return { count: calendars.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await setSyncStatus(locationId, 'calendars', 'failed', msg)
    throw err
  }
}

async function syncCalendarEvents(locationId: string, _token: string) {
  await setSyncStatus(locationId, 'calendar_events', 'running')
  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.calendarEvents.list()
    const events = (data?.events ?? []) as Record<string, unknown>[]

    const rows = events.map((e) => ({
      ghl_id: e.id as string,
      location_id: locationId,
      calendar_id: (e.calendarId as string) ?? null,
      contact_ghl_id: (e.contactId as string) ?? null,
      title: (e.title as string) ?? null,
      start_time: (e.startTime as string) ?? null,
      end_time: (e.endTime as string) ?? null,
      appointment_status: (e.appointmentStatus as string) ?? null,
      synced_at: new Date().toISOString(),
    }))
    await upsertBatch('cached_calendar_events', rows, 'location_id,ghl_id')

    await setSyncStatus(locationId, 'calendar_events', 'completed')
    return { count: events.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await setSyncStatus(locationId, 'calendar_events', 'failed', msg)
    throw err
  }
}

// ── Notes (per contact) ──────────────────────────────────────

async function syncNotes(locationId: string, _token: string) {
  await setSyncStatus(locationId, 'notes', 'running')
  try {
    const sb = createAdminClient()
    const ghl = await getGhlClient(locationId)

    // Get all cached contacts to iterate
    const { data: contacts } = await sb
      .from('cached_contacts')
      .select('ghl_id')
      .eq('location_id', locationId)

    let totalCount = 0
    for (const contact of contacts ?? []) {
      try {
        const data = await ghl.notes.list(contact.ghl_id)
        const notes: Record<string, unknown>[] = data?.notes ?? []
        if (notes.length === 0) continue

        const rows = notes.map((n) => ({
          ghl_id: n.id as string,
          location_id: locationId,
          contact_ghl_id: contact.ghl_id,
          body: (n.body as string) ?? null,
          date_added: (n.dateAdded as string) ?? null,
          created_by: (n.userId as string) ?? null,
          synced_at: new Date().toISOString(),
        }))
        await upsertBatch('cached_notes', rows, 'location_id,ghl_id')
        totalCount += notes.length
      } catch {
        // Skip individual contact failures
      }
    }

    await setSyncStatus(locationId, 'notes', 'completed')
    return { count: totalCount }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await setSyncStatus(locationId, 'notes', 'failed', msg)
    throw err
  }
}

// ── Tasks (per contact) ──────────────────────────────────────

async function syncTasks(locationId: string, _token: string) {
  await setSyncStatus(locationId, 'tasks', 'running')
  try {
    const sb = createAdminClient()
    const ghl = await getGhlClient(locationId)

    const { data: contacts } = await sb
      .from('cached_contacts')
      .select('ghl_id')
      .eq('location_id', locationId)

    let totalCount = 0
    for (const contact of contacts ?? []) {
      try {
        const data = await ghl.tasks.list(contact.ghl_id)
        const tasks: Record<string, unknown>[] = data?.tasks ?? []
        if (tasks.length === 0) continue

        const rows = tasks.map((t) => ({
          ghl_id: t.id as string,
          location_id: locationId,
          contact_ghl_id: contact.ghl_id,
          title: (t.title as string) ?? null,
          due_date: (t.dueDate as string) ?? null,
          completed: t.completed === true,
          synced_at: new Date().toISOString(),
        }))
        await upsertBatch('cached_tasks', rows, 'location_id,ghl_id')
        totalCount += tasks.length
      } catch {
        // Skip individual contact failures
      }
    }

    await setSyncStatus(locationId, 'tasks', 'completed')
    return { count: totalCount }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await setSyncStatus(locationId, 'tasks', 'failed', msg)
    throw err
  }
}

// ── Main Entry Point ─────────────────────────────────────────

export async function bulkSyncLocation(
  locationId: string,
  entities?: EntityType[],
): Promise<Record<string, { count: number } | { error: string }>> {
  const token = await getGhlTokenForLocation(locationId)
  const toSync = entities ?? ALL_ENTITIES
  const results: Record<string, { count: number } | { error: string }> = {}

  for (const entity of toSync) {
    try {
      switch (entity) {
        case 'custom_fields':
          results[entity] = await syncCustomFields(locationId, token)
          break
        case 'tags':
          results[entity] = await syncTags(locationId, token)
          break
        case 'users':
          results[entity] = await syncUsers(locationId, token)
          break
        case 'contacts':
          results[entity] = await syncContacts(locationId, token)
          break
        case 'opportunities':
          results[entity] = await syncOpportunities(locationId, token)
          break
        case 'pipelines':
          results[entity] = await syncPipelines(locationId, token)
          break
        case 'conversations':
          results[entity] = await syncConversations(locationId, token)
          break
        case 'calendars':
          results[entity] = await syncCalendars(locationId, token)
          break
        case 'calendar_events':
          results[entity] = await syncCalendarEvents(locationId, token)
          break
        case 'notes':
          results[entity] = await syncNotes(locationId, token)
          break
        case 'tasks':
          results[entity] = await syncTasks(locationId, token)
          break
      }
    } catch (err) {
      results[entity] = { error: err instanceof Error ? err.message : String(err) }
    }
  }

  return results
}

/** Get sync status for all entities of a location */
export async function getSyncStatus(locationId: string) {
  const sb = createAdminClient()
  const { data } = await sb
    .from('sync_status')
    .select('*')
    .eq('location_id', locationId)
  return data ?? []
}
