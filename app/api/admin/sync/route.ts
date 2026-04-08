import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'
import { bulkSyncLocation, getSyncStatus } from '@/lib/sync/bulkSync'
import { syncAllLocationUsers } from '@/lib/sync/syncAllUsers'

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
    .select('role, agency_id')
    .eq('id', user.id)
    .single()

  // Super admin or admin can sync
  if (profile?.role === 'super_admin' || profile?.role === 'admin') {
    return { user, agencyId: profile.agency_id }
  }

  return null
}

/** POST — trigger bulk sync for a location */
export async function POST(request: Request) {
  const auth = await getAuthenticatedAdmin()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const locationId = body?.locationId
  if (!locationId || typeof locationId !== 'string') {
    return NextResponse.json({ error: 'locationId required' }, { status: 400 })
  }

  // Agency owners can only sync locations belonging to their agency
  const sb = createAdminClient()
  if (auth.agencyId) {
    const { data: loc } = await sb.from('locations').select('agency_id').eq('location_id', locationId).maybeSingle()
    if (loc?.agency_id && loc.agency_id !== auth.agencyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const { data: conn } = await sb
      .from('ghl_connections')
      .select('refresh_token')
      .eq('location_id', locationId)
      .maybeSingle()

    let results: Record<string, unknown> = {}
    if (conn?.refresh_token) {
      // Has OAuth — full data sync
      results = await bulkSyncLocation(locationId, body.entities)
    } else {
      results = { skipped: 'Location non ha connessione OAuth. Connettila prima di sincronizzare i dati.' }
    }

    // User sync for this location only (fast — single location)
    const userSync = await syncAllLocationUsers(locationId).catch(() => ({ skipped: true }))

    return NextResponse.json({ ok: true, results, userSync })
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
  const auth = await getAuthenticatedAdmin()
  if (!auth) {
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
