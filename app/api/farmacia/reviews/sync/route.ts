import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { syncReviews } from '@/lib/farmacia/reviews'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

/** Fetch GHL reputation reviews into farmacia_reviews. Owner-only. */
export async function POST(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  const isOwner = profile?.role === 'super_admin' || profile?.role === 'admin' || (!!profile?.agency_id && isBibotAgency(profile.agency_id))
  if (!isOwner) return new Response('Forbidden', { status: 403 })

  try {
    const result = await syncReviews()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Sync failed' }, { status: 500 })
  }
}
