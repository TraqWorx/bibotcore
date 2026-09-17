import type { NextRequest } from 'next/server'
import { verifyEmbedToken } from '@/lib/auth/verifyEmbedToken'
import { EMBED_TOKEN_HEADER } from '@/lib/widgets/embedToken'

export interface EmbedTokenGrant {
  /** Data sources the saved dashboard uses; a token grants nothing beyond these. */
  dataSources: Set<string>
}

function collectDataSources(node: unknown, out: Set<string>) {
  if (Array.isArray(node)) {
    for (const item of node) collectDataSources(item, out)
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'dataSource' && typeof value === 'string') out.add(value)
      else collectDataSources(value, out)
    }
  }
}

/**
 * Public embed links carry a per-location token instead of a session. The embed
 * page's data requests forward it in a header; this resolves what it allows.
 */
export async function getEmbedTokenGrant(req: NextRequest, locationId: string): Promise<EmbedTokenGrant | null> {
  const token = req.headers.get(EMBED_TOKEN_HEADER)
  if (!token) return null
  const config = await verifyEmbedToken(locationId, token)
  if (!config) return null
  // 'users' feeds the dashboard's team filter
  const dataSources = new Set<string>(['none', 'users'])
  collectDataSources(config.config, dataSources)
  return { dataSources }
}
