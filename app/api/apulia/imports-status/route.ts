import { NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Lightweight polling endpoint for the Imports page Storico. */
export async function GET() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') {
    if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: history } = await sb
    .from('apulia_imports')
    .select('id, kind, filename, rows_total, created, updated, tagged, untagged, unmatched, skipped, duration_ms, triggered_by, created_at, status, progress_done, progress_total, last_progress_at, summary, error_msg')
    .order('created_at', { ascending: false })
    .limit(15)

  return NextResponse.json({ history: history ?? [] })
}
