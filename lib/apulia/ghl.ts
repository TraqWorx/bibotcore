import { createAdminClient } from '@/lib/supabase-server'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { APULIA_LOCATION_ID, GHL_BASE } from './fields'

let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Cached Apulia Power location-scoped OAuth token. The token itself rotates
 * every ~24h via the cron, but the read-from-DB hop is wasteful at scale (we
 * make thousands of calls during a CSV import). 30-min in-memory cache is safe
 * because a refresh always lands at /api/cron/refresh-ghl-tokens with at least
 * 1h of validity left on the new token.
 */
export async function getApuliaToken(force = false): Promise<string> {
  if (!force && cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token
  const sb = createAdminClient()
  const { data: conn } = await sb
    .from('ghl_connections')
    .select('access_token, refresh_token, expires_at, company_id')
    .eq('location_id', APULIA_LOCATION_ID)
    .single()
  if (!conn) throw new Error('Apulia Power is not OAuth-connected')
  const fresh = await refreshIfNeeded(APULIA_LOCATION_ID, conn)
  cachedToken = { token: fresh, expiresAt: Date.now() + 30 * 60 * 1000 }
  return fresh
}

/** Common headers helper. */
export async function ghlHeaders(): Promise<Record<string, string>> {
  const t = await getApuliaToken()
  return { Authorization: `Bearer ${t}`, Version: '2021-07-28', 'Content-Type': 'application/json' }
}

/**
 * Fetch with retry on 401 (token rotated mid-run) and 429 (rate limit).
 * 429 retries up to 5 times with exponential backoff (capped at 8s),
 * since GHL's 100 req/10s limit is easy to brush against during bulk
 * imports even with bounded concurrency. Throws on terminal failure.
 */
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
  return r
}

/**
 * Run async tasks with bounded concurrency. Returns results in input order.
 */
export async function pmap<T, U>(
  items: T[],
  worker: (item: T, i: number) => Promise<U>,
  concurrency = 6,
): Promise<U[]> {
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
