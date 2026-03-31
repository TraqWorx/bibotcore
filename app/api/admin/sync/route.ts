import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'
import { bulkSyncLocation, getSyncStatus } from '@/lib/sync/bulkSync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for large locations

async function getAuthenticatedAdmin() {
  const cookieStore = await cookies()
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    },
  )

  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return null

  const sb = createAdminClient()
  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') return null
  return user
}

/** POST — trigger bulk sync for a location */
export async function POST(request: Request) {
  const admin = await getAuthenticatedAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const locationId = body?.locationId
  if (!locationId || typeof locationId !== 'string') {
    return NextResponse.json({ error: 'locationId required' }, { status: 400 })
  }

  try {
    const results = await bulkSyncLocation(locationId, body.entities)
    return NextResponse.json({ ok: true, results })
  } catch (err) {
    console.error('[admin/sync] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 },
    )
  }
}

/** GET — check sync status for a location */
export async function GET(request: Request) {
  const admin = await getAuthenticatedAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('locationId')
  if (!locationId) {
    return NextResponse.json({ error: 'locationId required' }, { status: 400 })
  }

  const statuses = await getSyncStatus(locationId)
  return NextResponse.json({ statuses })
}
