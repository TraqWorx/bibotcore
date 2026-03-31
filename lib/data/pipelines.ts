/**
 * Pipelines data access layer — reads from Supabase cache.
 */

import { createAdminClient } from '@/lib/supabase-server'
import { getGhlClient } from '@/lib/ghl/ghlClient'

export type CachedPipeline = {
  ghl_id: string
  location_id: string
  name: string | null
  stages: { id: string; name: string }[]
}

export async function listPipelines(
  locationId: string,
): Promise<{ pipelines: CachedPipeline[]; fromCache: boolean }> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('cached_pipelines')
    .select('ghl_id, location_id, name, stages')
    .eq('location_id', locationId)

  if (data && data.length > 0) {
    const pipelines = data.map((p) => ({
      ...p,
      stages: Array.isArray(p.stages) ? p.stages : [],
    })) as CachedPipeline[]
    return { pipelines, fromCache: true }
  }

  return { pipelines: await fetchFromGhl(locationId), fromCache: false }
}

async function fetchFromGhl(locationId: string): Promise<CachedPipeline[]> {
  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.pipelines.list()
    const pipelines: Record<string, unknown>[] = data?.pipelines ?? []
    return pipelines.map((p) => ({
      ghl_id: p.id as string,
      location_id: locationId,
      name: (p.name as string) ?? null,
      stages: Array.isArray(p.stages) ? p.stages as { id: string; name: string }[] : [],
    }))
  } catch {
    return []
  }
}
