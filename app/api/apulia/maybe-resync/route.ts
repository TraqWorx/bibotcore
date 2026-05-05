import { NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { fullSyncCache } from '@/lib/apulia/cache'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Background trigger called by Apulia list pages to keep the cache fresh
 * without forcing the operator to push a button. Only fires a full sync
 * when the cache is older than `staleMinutes` (default 10) — otherwise
 * returns immediately. Owner / admin / super_admin only.
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
  const staleMinutes = Number(url.searchParams.get('staleMinutes') ?? '10')

  const { data: latest } = await sb
    .from('apulia_contacts')
    .select('cached_at')
    .order('cached_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const ageMs = latest?.cached_at ? Date.now() - new Date(latest.cached_at).getTime() : Number.POSITIVE_INFINITY
  const ageMinutes = ageMs / 60000

  if (ageMinutes < staleMinutes) {
    return NextResponse.json({ skipped: true, ageMinutes: Math.round(ageMinutes) })
  }

  try {
    const r = await fullSyncCache()
    return NextResponse.json({ synced: true, ...r })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
