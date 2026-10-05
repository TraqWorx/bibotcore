import { createAdminClient } from '@/lib/supabase-server'

/**
 * Read-through cache in `app_cache` (migration 144), for values that are slow
 * because they come from a third party rather than from our own database.
 *
 * Deliberately not Next's unstable_cache: these pages are `force-dynamic` and
 * nothing was being held between requests. A row with a timestamp is also
 * something we can inspect, and expire by hand when we need to.
 *
 * If `compute` throws and a stale entry exists, the stale value is returned — a
 * Stripe or GHL outage should show the last known figures, not zeroes.
 */
export async function cached<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const sb = createAdminClient()
  const { data } = await sb.from('app_cache').select('value, updated_at').eq('key', key).maybeSingle()

  const ageSeconds = data?.updated_at
    ? (Date.now() - new Date(data.updated_at as string).getTime()) / 1000
    : Number.POSITIVE_INFINITY
  if (data && ageSeconds < ttlSeconds) return data.value as T

  try {
    const fresh = await compute()
    await sb.from('app_cache').upsert(
      { key, value: fresh as unknown, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
    return fresh
  } catch (err) {
    if (data) return data.value as T
    throw err
  }
}
