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

type EntityType = 'contacts' | 'opportunities' | 'pipelines' | 'conversations' | 'custom_fields'
const ALL_ENTITIES: EntityType[] = ['custom_fields', 'contacts', 'opportunities', 'pipelines', 'conversations']

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
