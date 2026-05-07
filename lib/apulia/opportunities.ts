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
  updatedAt?: string
}

/** All Apulia pipelines + their stages from GHL. */
export async function listPipelines(): Promise<Pipeline[]> {
  const r = await ghlFetch(`/opportunities/pipelines?locationId=${APULIA_LOCATION_ID}`)
  if (!r.ok) throw new Error(`GHL pipelines: HTTP ${r.status}`)
  const json = await r.json() as { pipelines?: RawPipeline[] }
  return (json.pipelines ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    stages: (p.stages ?? []).map((s) => ({ id: s.id, name: s.name, position: s.position })),
  }))
}

/**
 * All Apulia opportunities (paginated). GHL returns up to 100 per page;
 * we follow nextPageUrl until exhausted. Contacts are enriched from the
 * local apulia_contacts cache so we don't N+1 GHL contact reads.
 */
export async function listOpportunities(): Promise<Opportunity[]> {
  const out: RawOpportunity[] = []
  let url: string | null = `/opportunities/search?location_id=${APULIA_LOCATION_ID}&limit=100`
  while (url) {
    const r = await ghlFetch(url)
    if (!r.ok) throw new Error(`GHL opportunities: HTTP ${r.status}`)
    const json = await r.json() as { opportunities?: RawOpportunity[]; meta?: { nextPageUrl?: string | null; startAfterId?: string; startAfter?: number } }
    out.push(...(json.opportunities ?? []))
    const next = json.meta?.nextPageUrl ?? null
    if (!next || next === url) break
    // Some GHL responses give a relative path, others absolute.
    url = next.startsWith('http') ? next : next
  }

  // Enrich with local contact cache.
  const ids = Array.from(new Set(out.map((o) => o.contactId).filter((x): x is string => !!x)))
  const contactMap = new Map<string, { name: string; email?: string; phone?: string; tags?: string[] }>()
  if (ids.length > 0) {
    const sb = createAdminClient()
    // .in() caps near 1000 — chunk if we ever exceed.
    const CHUNK = 500
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK)
      const { data } = await sb.from('apulia_contacts').select('ghl_id, first_name, last_name, email, phone, tags').in('ghl_id', slice)
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

  return out.map((o) => {
    const c = o.contactId ? contactMap.get(o.contactId) : undefined
    return {
      id: o.id,
      name: o.name,
      pipelineId: o.pipelineId ?? '',
      pipelineStageId: o.pipelineStageId ?? '',
      status: o.status,
      monetaryValue: o.monetaryValue != null ? Number(o.monetaryValue) : undefined,
      contactId: o.contactId,
      contactName: c?.name,
      contactEmail: c?.email,
      contactPhone: c?.phone,
      contactTags: c?.tags,
      updatedAt: o.updatedAt,
    }
  })
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
  return { ok: true }
}
