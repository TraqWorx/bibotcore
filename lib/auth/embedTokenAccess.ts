import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { isBillingExempt } from '@/lib/agency/capabilities'
import { verifyEmbedToken } from '@/lib/auth/verifyEmbedToken'
import { EMBED_TOKEN_HEADER } from '@/lib/widgets/embedToken'

export interface EmbedTokenGrant {
  /** Data sources the saved dashboard uses; a token grants nothing beyond these. */
  dataSources: Set<string>
  /** Filter sets saved on the dashboard's widgets, per data source. */
  savedFilters: Map<string, Record<string, string>[]>
}

function collectWidgetData(node: unknown, grant: EmbedTokenGrant) {
  if (Array.isArray(node)) {
    for (const item of node) collectWidgetData(item, grant)
    return
  }
  if (!node || typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  if (typeof obj.dataSource === 'string') {
    grant.dataSources.add(obj.dataSource)
    const filters = obj.filters && typeof obj.filters === 'object' ? (obj.filters as Record<string, string>) : {}
    const list = grant.savedFilters.get(obj.dataSource) ?? []
    list.push(filters)
    grant.savedFilters.set(obj.dataSource, list)
  }
  for (const [key, value] of Object.entries(obj)) {
    if (key !== 'filters') collectWidgetData(value, grant)
  }
}

function sameFilters(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((k) => String(a[k]) === String(b[k]))
}

/**
 * A token caller may only send the exact filters a saved widget uses, so it can't
 * search or page past what the dashboard shows.
 */
export function embedFiltersAllowed(grant: EmbedTokenGrant, dataSource: string, filters: Record<string, string> | undefined): boolean {
  const requested = filters ?? {}
  return (grant.savedFilters.get(dataSource) ?? [{}]).some((saved) => sameFilters(saved, requested))
}

/**
 * Public embed links carry a per-location token instead of a session. The embed
 * page's data requests forward it in a header; this resolves what it allows.
 * Follows the embed page's paywall: Bibot bypasses, others need an active subscription.
 */
export async function getEmbedTokenGrant(req: NextRequest, locationId: string): Promise<EmbedTokenGrant | null> {
  const token = req.headers.get(EMBED_TOKEN_HEADER)
  if (!token) return null
  const config = await verifyEmbedToken(locationId, token)
  if (!config) return null

  if (!(await isBillingExempt(config.agency_id))) {
    const { data: subscription } = await createAdminClient()
      .from('agency_subscriptions').select('status')
      .eq('agency_id', config.agency_id).eq('location_id', locationId).eq('status', 'active')
      .maybeSingle()
    if (!subscription) return null
  }

  const grant: EmbedTokenGrant = { dataSources: new Set(['none']), savedFilters: new Map() }
  collectWidgetData(config.config, grant)
  return grant
}
