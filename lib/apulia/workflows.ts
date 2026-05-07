import { ghlFetch } from './ghl'
import { APULIA_LOCATION_ID } from './fields'

export interface Workflow {
  id: string
  name: string
  status: string
  version?: number
  locationId?: string
}

/**
 * List all GHL workflows for Apulia. Read-only — the public API exposes
 * GET /workflows/?locationId= but no PATCH endpoint, so we can't toggle
 * published/draft from here. The settings panel uses this to surface
 * status so the owner knows what's wired up before triggering a tag.
 */
export async function listApuliaWorkflows(): Promise<Workflow[]> {
  const r = await ghlFetch(`/workflows/?locationId=${APULIA_LOCATION_ID}`)
  if (!r.ok) throw new Error(`GHL workflows: HTTP ${r.status}`)
  const json = await r.json() as { workflows?: Workflow[] }
  return (json.workflows ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))
}
