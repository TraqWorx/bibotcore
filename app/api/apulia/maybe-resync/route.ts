import { NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { fullSyncCache } from '@/lib/apulia/cache'
import { ghlFetch } from '@/lib/apulia/ghl'
import { APULIA_LOCATION_ID } from '@/lib/apulia/fields'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Smart sync trigger called by Apulia list pages. Three triggers:
 *   1. Cache age > staleMinutes (default 2)
 *   2. Drift detected: GHL contact count != cache count
 *   3. force=1 query param (caller forces it)
 *
 * Returning fast when cache is healthy keeps page renders snappy.
 * Owner / admin / super_admin only.
 */
export async function POST(req: Request) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') {
    if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const staleMinutes = Number(url.searchParams.get('staleMinutes') ?? '2')
  const force = url.searchParams.get('force') === '1'

  const [{ data: latest }, { count: cacheCount }, ghlCountResult] = await Promise.all([
    sb.from('apulia_contacts').select('cached_at').order('cached_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('apulia_contacts').select('id', { count: 'exact', head: true }),
    ghlFetch('/contacts/search', { method: 'POST', body: JSON.stringify({ locationId: APULIA_LOCATION_ID, pageLimit: 1 }) }).then((r) => r.json()).catch(() => ({ total: -1 })),
  ])

  const ghlCount = (ghlCountResult as { total?: number }).total ?? -1
  const ageMs = latest?.cached_at ? Date.now() - new Date(latest.cached_at).getTime() : Number.POSITIVE_INFINITY
  const ageMinutes = ageMs / 60000
  const drift = ghlCount >= 0 ? ghlCount !== (cacheCount ?? 0) : false

  if (!force && !drift && ageMinutes < staleMinutes) {
    return NextResponse.json({
      skipped: true,
      ageMinutes: Math.round(ageMinutes),
      cacheCount: cacheCount ?? 0,
      ghlCount,
    })
  }

  try {
    const r = await fullSyncCache()
    return NextResponse.json({
      synced: true,
      reason: force ? 'forced' : drift ? 'drift' : 'stale',
      ageMinutesBefore: Math.round(ageMinutes),
      cacheCountBefore: cacheCount ?? 0,
      ghlCountBefore: ghlCount,
      ...r,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
