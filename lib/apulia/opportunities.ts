import { ghlFetch } from './ghl'
import { APULIA_LOCATION_ID } from './fields'
import { createAdminClient } from '@/lib/supabase-server'

export interface PipelineStage {
  id: string
  name: string
  position?: number
}

export interface Pipeline {
  id: string
  name: string
  stages: PipelineStage[]
}

export interface Opportunity {
  id: string
  name?: string
  pipelineId: string
  pipelineStageId: string
  status?: string
  monetaryValue?: number
  contactId?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  contactTags?: string[]
  updatedAt?: string
}

interface RawPipeline {
  id: string
  name: string
  stages?: Array<{ id: string; name: string; position?: number }>
}
interface RawOpportunity {
  id: string
  name?: string
  pipelineId?: string
  pipelineStageId?: string
  status?: string
  monetaryValue?: number
  contactId?: string
  source?: string
  assignedTo?: string
  updatedAt?: string
}

/* ============================================================
 * Cached reads (DB) — used by the page
 * ============================================================ */

export async function listPipelinesCached(): Promise<Pipeline[]> {
  const sb = createAdminClient()
  const { data } = await sb.from('apulia_pipelines').select('ghl_id, name, stages').order('name')
  return ((data ?? []) as Array<{ ghl_id: string; name: string; stages: PipelineStage[] | null }>).map((p) => ({
    id: p.ghl_id,
    name: p.name,
    stages: (p.stages ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
  }))
}

export async function listOpportunitiesCached(): Promise<Opportunity[]> {
  const sb = createAdminClient()
  // Paginate to dodge the PostgREST 1000-row cap once Apulia has many opps.
  const opps: Array<{ ghl_id: string; name: string | null; pipeline_id: string; pipeline_stage_id: string; status: string | null; monetary_value: number | null; contact_ghl_id: string | null; ghl_updated_at: string | null }> = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from('apulia_opportunities')
      .select('ghl_id, name, pipeline_id, pipeline_stage_id, status, monetary_value, contact_ghl_id, ghl_updated_at')
      .range(from, from + 999)
    if (!data || data.length === 0) break
    opps.push(...(data as typeof opps))
    if (data.length < 1000) break
  }

  // Enrich from local apulia_contacts (single batched query).
  const ids = Array.from(new Set(opps.map((o) => o.contact_ghl_id).filter((x): x is string => !!x)))
  const contactMap = new Map<string, { name: string; email?: string; phone?: string; tags?: string[] }>()
  if (ids.length > 0) {
    const sb2 = createAdminClient()
    const CHUNK = 500
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK)
      const { data } = await sb2.from('apulia_contacts').select('ghl_id, first_name, last_name, email, phone, tags').in('ghl_id', slice)
      for (const c of (data ?? []) as Array<{ ghl_id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; tags: string[] | null }>) {
        contactMap.set(c.ghl_id, {
          name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '—',
          email: c.email ?? undefined,
          phone: c.phone ?? undefined,
          tags: c.tags ?? undefined,
        })
      }
    }
  }

  return opps.map((o) => {
    const c = o.contact_ghl_id ? contactMap.get(o.contact_ghl_id) : undefined
    return {
      id: o.ghl_id,
      name: o.name ?? undefined,
      pipelineId: o.pipeline_id,
      pipelineStageId: o.pipeline_stage_id,
      status: o.status ?? undefined,
      monetaryValue: o.monetary_value != null ? Number(o.monetary_value) : undefined,
      contactId: o.contact_ghl_id ?? undefined,
      contactName: c?.name,
      contactEmail: c?.email,
      contactPhone: c?.phone,
      contactTags: c?.tags,
      updatedAt: o.ghl_updated_at ?? undefined,
    }
  })
}

/* ============================================================
 * Sync from GHL
 * ============================================================ */

async function fetchAllRawOpportunities(): Promise<RawOpportunity[]> {
  const out: RawOpportunity[] = []
  let url: string | null = `/opportunities/search?location_id=${APULIA_LOCATION_ID}&limit=100`
  while (url) {
    const r = await ghlFetch(url)
    if (!r.ok) throw new Error(`GHL opportunities: HTTP ${r.status}`)
    const json = await r.json() as { opportunities?: RawOpportunity[]; meta?: { nextPageUrl?: string | null } }
    out.push(...(json.opportunities ?? []))
    const next = json.meta?.nextPageUrl ?? null
    if (!next || next === url) break
    url = next
  }
  return out
}

async function fetchRawPipelines(): Promise<RawPipeline[]> {
  const r = await ghlFetch(`/opportunities/pipelines?locationId=${APULIA_LOCATION_ID}`)
  if (!r.ok) throw new Error(`GHL pipelines: HTTP ${r.status}`)
  const json = await r.json() as { pipelines?: RawPipeline[] }
  return json.pipelines ?? []
}

/**
 * Full sync: pull fresh pipelines + opportunities from GHL and replace
 * the cache. Pipelines first so the FK to apulia_pipelines is satisfied.
 * Returns how many rows landed in each table.
 */
export async function syncOpportunities(): Promise<{ pipelines: number; opportunities: number }> {
  const sb = createAdminClient()
  const [pipelines, opps] = await Promise.all([fetchRawPipelines(), fetchAllRawOpportunities()])

  // Upsert pipelines.
  if (pipelines.length > 0) {
    const rows = pipelines.map((p) => ({
      ghl_id: p.id,
      name: p.name,
      stages: p.stages ?? [],
      synced_at: new Date().toISOString(),
    }))
    const { error } = await sb.from('apulia_pipelines').upsert(rows, { onConflict: 'ghl_id' })
    if (error) throw new Error(`upsert pipelines: ${error.message}`)
    // Drop pipelines that no longer exist in GHL.
    const keepIds = new Set(pipelines.map((p) => p.id))
    const { data: existing } = await sb.from('apulia_pipelines').select('ghl_id')
    const stale = (existing ?? []).map((r) => (r as { ghl_id: string }).ghl_id).filter((id) => !keepIds.has(id))
    if (stale.length > 0) await sb.from('apulia_pipelines').delete().in('ghl_id', stale)
  }

  // Upsert opportunities. Skip rows missing pipelineId/pipelineStageId.
  const validOpps = opps.filter((o) => o.pipelineId && o.pipelineStageId)
  if (validOpps.length > 0) {
    const rows = validOpps.map((o) => ({
      ghl_id: o.id,
      name: o.name ?? null,
      pipeline_id: o.pipelineId!,
      pipeline_stage_id: o.pipelineStageId!,
      status: o.status ?? null,
      monetary_value: o.monetaryValue ?? null,
      contact_ghl_id: o.contactId ?? null,
      source: o.source ?? null,
      assigned_to: o.assignedTo ?? null,
      ghl_updated_at: o.updatedAt ?? null,
      synced_at: new Date().toISOString(),
    }))
    const CHUNK = 500
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await sb.from('apulia_opportunities').upsert(rows.slice(i, i + CHUNK), { onConflict: 'ghl_id' })
      if (error) throw new Error(`upsert opportunities ${i}: ${error.message}`)
    }
  }
  // Drop opportunities that no longer exist in GHL.
  const keepOppIds = new Set(validOpps.map((o) => o.id))
  // Paginate to dodge 1000-row cap on the existing read.
  const existingOppIds: string[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('apulia_opportunities').select('ghl_id').range(from, from + 999)
    if (!data || data.length === 0) break
    existingOppIds.push(...((data as Array<{ ghl_id: string }>).map((r) => r.ghl_id)))
    if (data.length < 1000) break
  }
  const staleOpps = existingOppIds.filter((id) => !keepOppIds.has(id))
  if (staleOpps.length > 0) {
    const CHUNK = 200
    for (let i = 0; i < staleOpps.length; i += CHUNK) {
      await sb.from('apulia_opportunities').delete().in('ghl_id', staleOpps.slice(i, i + CHUNK))
    }
  }

  return { pipelines: pipelines.length, opportunities: validOpps.length }
}

/** Move an opportunity to a different pipeline stage. */
export async function moveOpportunityStage(opportunityId: string, pipelineStageId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await ghlFetch(`/opportunities/${opportunityId}`, {
    method: 'PUT',
    body: JSON.stringify({ pipelineStageId }),
  })
  if (!r.ok) {
    let msg = `HTTP ${r.status}`
    try { const j = await r.json() as { message?: string }; if (j.message) msg = j.message } catch {}
    return { ok: false, error: msg }
  }
  // Update cache so the page reflects the move without a full resync.
  const sb = createAdminClient()
  await sb.from('apulia_opportunities').update({ pipeline_stage_id: pipelineStageId, ghl_updated_at: new Date().toISOString() }).eq('ghl_id', opportunityId)
  return { ok: true }
}
