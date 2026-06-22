import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { canWriteBibotDesign } from '@/lib/auth/designOwner'
import { APULIA_LOCATION_ID } from '@/lib/apulia/fields'
import { recomputeCommissions } from '@/lib/apulia/recompute'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  if (!(await canWriteBibotDesign(user.id, profile, APULIA_LOCATION_ID))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const result = await recomputeCommissions()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
