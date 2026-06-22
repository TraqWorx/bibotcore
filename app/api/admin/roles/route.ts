import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase-server'

async function getAuthUser(req: NextRequest) {
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return null
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('role, agency_id').eq('id', user.id).single()
  return { ...user, platformRole: profile?.role ?? 'user', agencyId: profile?.agency_id ?? null }
}

// Users and per-location roles are managed in GoHighLevel and synced into the
// app (hourly cron + webhooks). The app is read-only for users/roles — writing
// here would just be overwritten on the next sync, so the mutating endpoints are
// disabled to keep GHL the single source of truth.
const MANAGED_IN_GHL = NextResponse.json(
  { error: 'Users and roles are managed in GoHighLevel.' },
  { status: 405 },
)

/** GET — list all users with roles (super_admin sees all, admin sees own agency) */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // Only platform/agency admins may read the user roster. A portal contact or
  // plain agency member must not enumerate their agency's users.
  if (user.platformRole !== 'super_admin' && user.platformRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sb = createAdminClient()

  type Membership = { user_id: string; location_id: string; role: string }
  type Profile = { id: string; email: string; role: string }
  type Loc = { location_id: string; name: string | null }
  let memberships: Membership[] | null
  let profiles: Profile[] | null
  let locations: Loc[] | null

  if (user.platformRole === 'super_admin') {
    const [m, p, l] = await Promise.all([
      sb.from('profile_locations').select('user_id, location_id, role'),
      sb.from('profiles').select('id, email, role'),
      sb.from('locations').select('location_id, name'),
    ])
    memberships = m.data; profiles = p.data; locations = l.data
  } else {
    // Admins are scoped to their own agency's locations + users.
    if (!user.agencyId) return NextResponse.json({ users: [], locations: [] })
    const { data: agencyLocs } = await sb.from('locations').select('location_id, name').eq('agency_id', user.agencyId)
    const locIds = (agencyLocs ?? []).map((l) => l.location_id)
    const [m, p] = await Promise.all([
      sb.from('profile_locations').select('user_id, location_id, role').in('location_id', locIds),
      sb.from('profiles').select('id, email, role').eq('agency_id', user.agencyId),
    ])
    memberships = m.data; profiles = p.data; locations = agencyLocs
  }

  const emailMap = new Map((profiles ?? []).map((p) => [p.id, p.email]))
  const nameMap = new Map((locations ?? []).map((l) => [l.location_id, l.name]))
  const locationList = (locations ?? []).map((l) => ({ id: l.location_id, name: l.name ?? l.location_id }))

  const users = (memberships ?? []).map((m) => ({
    userId: m.user_id,
    email: emailMap.get(m.user_id) ?? 'unknown',
    role: m.role,
    locationId: m.location_id,
    locationName: nameMap.get(m.location_id) ?? m.location_id,
  }))

  return NextResponse.json({ users, locations: locationList })
}

/** PUT/POST/DELETE — disabled. Users & roles are managed in GoHighLevel. */
export async function PUT() { return MANAGED_IN_GHL }
export async function POST() { return MANAGED_IN_GHL }
export async function DELETE() { return MANAGED_IN_GHL }
