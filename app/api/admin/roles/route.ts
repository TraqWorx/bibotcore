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
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  return { ...user, platformRole: profile?.role ?? 'user' }
}

async function assertSuperAdmin(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || user.platformRole !== 'super_admin') return null
  return user
}

/** Check if user is super_admin OR location_admin for a specific location */
async function assertCanManageRoles(req: NextRequest, locationId?: string) {
  const user = await getAuthUser(req)
  if (!user) return null
  if (user.platformRole === 'super_admin') return user
  if (!locationId) return null
  const sb = createAdminClient()
  const { data: membership } = await sb
    .from('profile_locations')
    .select('role')
    .eq('user_id', user.id)
    .eq('location_id', locationId)
    .maybeSingle()
  if (membership?.role === 'location_admin') return user
  return null
}

/** GET — list all users with roles (super_admin sees all, location_admin sees own location) */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = createAdminClient()
  const [{ data: memberships }, { data: profiles }, { data: locations }] = await Promise.all([
    sb.from('profile_locations').select('user_id, location_id, role'),
    sb.from('profiles').select('id, email, role'),
    sb.from('locations').select('location_id, name'),
  ])

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

/** PUT — update a user's role (super_admin or location_admin) */
export async function PUT(req: NextRequest) {
  const body = await req.clone().json()
  if (!await assertCanManageRoles(req, body?.locationId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, locationId, role } = await req.json()
  if (!userId || !locationId || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (!['location_admin', 'team_member', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const sb = createAdminClient()
  const { error } = await sb
    .from('profile_locations')
    .update({ role })
    .eq('user_id', userId)
    .eq('location_id', locationId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** POST — add a user to a location */
export async function POST(req: NextRequest) {
  if (!await assertSuperAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, locationId, role } = await req.json()
  if (!email || !locationId || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const sb = createAdminClient()

  // Find or create the user
  const { data: profile } = await sb.from('profiles').select('id').eq('email', email.toLowerCase()).maybeSingle()
  let userId = profile?.id

  if (!userId) {
    // Create Supabase auth user
    const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email: email.toLowerCase(),
      email_confirm: true,
    })
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })
    userId = created?.user?.id
    if (userId) {
      await sb.from('profiles').upsert({ id: userId, email: email.toLowerCase(), role: 'agency' }, { onConflict: 'id' })
    }
  }

  if (!userId) return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })

  // Add to profile_locations
  const { error } = await sb.from('profile_locations').upsert(
    { user_id: userId, location_id: locationId, role },
    { onConflict: 'user_id,location_id' },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** DELETE — remove a user from a location */
export async function DELETE(req: NextRequest) {
  if (!await assertSuperAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, locationId } = await req.json()
  if (!userId || !locationId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const sb = createAdminClient()
  await sb.from('profile_locations').delete().eq('user_id', userId).eq('location_id', locationId)

  return NextResponse.json({ ok: true })
}
