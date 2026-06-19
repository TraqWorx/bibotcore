import { createAdminClient } from '@/lib/supabase-server'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { FARMACIA_LOCATION_ID, GHL_BASE } from './fields'

let cachedToken: { token: string; expiresAt: number } | null = null

/** Cached Farmacia location-scoped OAuth token (30-min in-memory cache). */
export async function getFarmaciaToken(force = false): Promise<string> {
  if (!force && cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token
  const sb = createAdminClient()
  const { data: conn } = await sb
    .from('ghl_connections')
    .select('access_token, refresh_token, expires_at, company_id')
    .eq('location_id', FARMACIA_LOCATION_ID)
    .single()
  if (!conn) throw new Error('Farmacia Cialdella is not OAuth-connected')
  const fresh = await refreshIfNeeded(FARMACIA_LOCATION_ID, conn)
  cachedToken = { token: fresh, expiresAt: Date.now() + 30 * 60 * 1000 }
  return fresh
}

export async function ghlHeaders(): Promise<Record<string, string>> {
  const t = await getFarmaciaToken()
  return { Authorization: `Bearer ${t}`, Version: '2021-07-28', 'Content-Type': 'application/json' }
}

export class GhlRateLimitError extends Error {
  constructor(public readonly path: string) {
    super(`GHL rate-limited after retries: ${path}`)
    this.name = 'GhlRateLimitError'
  }
}

/** Fetch with retry on 401 (token rotated) and 429 (rate limit). Mirrors lib/apulia/ghl.ts. */
export async function ghlFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith('http') ? path : GHL_BASE + path
  const opts = { ...(init ?? {}) }
  opts.headers = { ...(await ghlHeaders()), ...(init?.headers ?? {}) }

  let r = await fetch(url, opts)
  if (r.status === 401) {
    cachedToken = null
    opts.headers = { ...(await ghlHeaders()), ...(init?.headers ?? {}) }
    r = await fetch(url, opts)
  }
  let attempt = 0
  while (r.status === 429 && attempt < 5) {
    const retryAfter = Number(r.headers.get('retry-after') ?? 0)
    const backoffMs = retryAfter > 0
      ? retryAfter * 1000
      : Math.min(8000, 500 * Math.pow(2, attempt)) + Math.floor(Math.random() * 200)
    await new Promise((res) => setTimeout(res, backoffMs))
    r = await fetch(url, opts)
    attempt++
  }
  if (r.status === 429) throw new GhlRateLimitError(path)
  return r
}

export async function pmap<T, U>(items: T[], worker: (item: T, i: number) => Promise<U>, concurrency = 6): Promise<U[]> {
  const results = new Array<U>(items.length)
  let next = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
    }
  })
  await Promise.all(runners)
  return results
}
