/**
 * Opportunities data access layer — reads from Supabase cache.
 * Falls back to GHL API if cache is empty.
 */

import { createAdminClient } from '@/lib/supabase-server'
import { getGhlClient } from '@/lib/ghl/ghlClient'

export type CachedOpportunity = {
  ghl_id: string
  location_id: string
  name: string | null
  pipeline_id: string | null
  pipeline_stage_id: string | null
  contact_ghl_id: string | null
  monetary_value: number | null
  status: string | null
  assigned_to: string | null
  raw: Record<string, unknown> | null
}

async function isCacheReady(locationId: string): Promise<boolean> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('sync_status')
    .select('status')
    .eq('location_id', locationId)
    .eq('entity_type', 'opportunities')
    .single()
  return data?.status === 'completed'
}

/** List all opportunities for a location */
export async function listOpportunities(
  locationId: string,
): Promise<{ opportunities: CachedOpportunity[]; fromCache: boolean }> {
  const cacheReady = await isCacheReady(locationId)

  if (!cacheReady) {
    return { opportunities: await fetchFromGhl(locationId), fromCache: false }
  }

  const sb = createAdminClient()
  const { data } = await sb
    .from('cached_opportunities')
    .select('*')
    .eq('location_id', locationId)

  return { opportunities: data ?? [], fromCache: true }
}

/** Get opportunities for a specific contact */
export async function getOpportunitiesByContact(
  locationId: string,
  contactGhlId: string,
): Promise<CachedOpportunity[]> {
  const cacheReady = await isCacheReady(locationId)

  if (!cacheReady) {
    const all = await fetchFromGhl(locationId)
    return all.filter((o) => o.contact_ghl_id === contactGhlId)
  }

  const sb = createAdminClient()
  const { data } = await sb
    .from('cached_opportunities')
    .select('*')
    .eq('location_id', locationId)
    .eq('contact_ghl_id', contactGhlId)

  return data ?? []
}

async function fetchFromGhl(locationId: string): Promise<CachedOpportunity[]> {
  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.opportunities.list()
    const opps: Record<string, unknown>[] = data?.opportunities ?? []
    return opps.map((o) => ({
      ghl_id: o.id as string,
      location_id: locationId,
      name: (o.name as string) ?? null,
      pipeline_id: (o.pipelineId as string) ?? null,
      pipeline_stage_id: (o.pipelineStageId as string) ?? null,
      contact_ghl_id: (o.contactId as string) ?? null,
      monetary_value: typeof o.monetaryValue === 'number' ? o.monetaryValue : null,
      status: (o.status as string) ?? null,
      assigned_to: (o.assignedTo as string) ?? null,
      raw: o,
    }))
  } catch {
    return []
  }
}
