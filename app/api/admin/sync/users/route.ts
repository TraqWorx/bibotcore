import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'
import { syncAllLocationUsers } from '@/lib/sync/syncAllUsers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function getAuthenticatedAdmin() {
  const cookieStore = await cookies()
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return null
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('role, agency_id').eq('id', user.id).single()
  if (profile?.role !== 'super_admin' && profile?.role !== 'admin') return null
  return { user, role: profile.role, agencyId: profile.agency_id }
}

export async function POST(request: Request) {
  const admin = await getAuthenticatedAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const locationId = body?.locationId as string | undefined

  const sb = createAdminClient()
  if (locationId) {
    // Single location — must belong to caller's agency (super_admin bypasses).
    if (admin.role !== 'super_admin') {
      if (!admin.agencyId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const { data: loc } = await sb.from('locations').select('agency_id').eq('location_id', locationId).maybeSingle()
      if (!loc || loc.agency_id !== admin.agencyId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else {
    // Sync ALL locations — platform only (super_admin or Bibot).
    const { isBibotAgency } = await import('@/lib/isBibotAgency')
    if (admin.role !== 'super_admin' && !isBibotAgency(admin.agencyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const result = await syncAllLocationUsers(locationId)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
