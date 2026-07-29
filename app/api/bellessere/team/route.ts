import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccessFast } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'
import { validateNewUser, buildCreateUserPayload } from '@/lib/bellessere/query'
import { ghlRoleToLocationRole } from '@/lib/auth/designOwner'
import { assertBellessereWrite, bellessereCanWrite } from '@/lib/bellessere/auth'

/**
 * Provision the Supabase login for ONE new member — lightweight + awaited so they
 * can sign in immediately, without the heavy full-location sync (which slowed the
 * add and could momentarily starve the roster read → a false "Nessun membro").
 */
async function provisionMemberLogin(email: string, ghlRole: string | null | undefined) {
  const e = email.trim().toLowerCase()
  if (!e) return
  const sb = createAdminClient()
  const { data: prof } = await sb.from('profiles').select('id, role').eq('email', e).maybeSingle()
  let profileId = prof?.id as string | undefined
  if (!profileId) {
    const { data: created } = await sb.auth.admin.createUser({ email: e, email_confirm: true })
    if (created?.user) profileId = created.user.id
    else {
      // Auth user already exists (drift) — resolve its id from the user list.
      const { data } = await sb.auth.admin.listUsers({ perPage: 1000 })
      profileId = data?.users?.find(u => u.email?.toLowerCase() === e)?.id
    }
  }
  if (!profileId || prof?.role === 'super_admin') return
  if (!prof) {
    await sb.from('profiles').upsert(
      { id: profileId, email: e, role: 'agency', location_id: BELLESSERE_LOCATION_ID },
      { onConflict: 'id' },
    )
  }
  await sb.from('profile_locations').upsert(
    { user_id: profileId, location_id: BELLESSERE_LOCATION_ID, role: ghlRoleToLocationRole(ghlRole) },
    { onConflict: 'user_id,location_id' },
  )
}

/**
 * Revoke a removed member's dashboard login. Drops their Bellessere membership,
 * and if they belong to no other location, deletes their profile + auth user so
 * they can't sign back in. Never touches super_admin / admin accounts.
 */
async function revokeMemberLogin(email: string) {
  const e = email.trim().toLowerCase()
  if (!e) return
  const sb = createAdminClient()
  const { data: prof } = await sb.from('profiles').select('id, role').eq('email', e).maybeSingle()
  if (!prof || prof.role === 'super_admin' || prof.role === 'admin') return
  await sb.from('profile_locations').delete().eq('user_id', prof.id).eq('location_id', BELLESSERE_LOCATION_ID)
  const { count } = await sb.from('profile_locations').select('user_id', { count: 'exact', head: true }).eq('user_id', prof.id)
  if ((count ?? 0) > 0) return // still a member of another location — keep their login
  await sb.from('profiles').delete().eq('id', prof.id)
  await sb.auth.admin.deleteUser(prof.id).catch(() => {})
}

export const dynamic = 'force-dynamic'

const GHL = 'https://services.leadconnectorhq.com'
const V = '2021-07-28'

async function getConn() {
  const sb = createAdminClient()
  const { data: conn } = await sb
    .from('ghl_connections')
    .select('access_token, refresh_token, expires_at, company_id')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .single()
  if (!conn) throw new Error('No GHL connection for Bellessere')
  const token = await refreshIfNeeded(BELLESSERE_LOCATION_ID, conn)
  return { token, companyId: conn.company_id as string | null }
}

async function authCheck(req: NextRequest) {
  const access = await getLocationAccessFast(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

// GET — list team members from cache with their schedule id (for the editor)
export async function GET(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const sb = createAdminClient()
  const [{ data: users }, { data: schedules }] = await Promise.all([
    sb.from('bellessere_users').select('id, name, email, phone').eq('location_id', BELLESSERE_LOCATION_ID).order('name'),
    sb.from('bellessere_schedules').select('id, user_id').eq('location_id', BELLESSERE_LOCATION_ID),
  ])
  const schedByUser = new Map((schedules ?? []).map(s => [s.user_id, s.id]))
  const members = (users ?? []).map(u => ({
    id: u.id, name: u.name, email: u.email ?? '', phone: u.phone ?? '',
    scheduleId: schedByUser.get(u.id) ?? null,
  }))
  return NextResponse.json({ members, canWrite: await bellessereCanWrite() })
}

// POST — create a GHL user, assign to the location, then re-sync the roster
export async function POST(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const werr = await assertBellessereWrite()
  if (werr) return werr

  const input = await req.json().catch(() => ({}))
  const validationError = validateNewUser(input)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const { token, companyId } = await getConn()
  if (!companyId) return NextResponse.json({ error: 'companyId mancante sulla connessione GHL' }, { status: 400 })

  const res = await fetch(`${GHL}/users/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Version: V, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildCreateUserPayload(input, companyId, BELLESSERE_LOCATION_ID)),
  })
  const text = await res.text()
  let data: Record<string, unknown> = {}
  try { data = JSON.parse(text) } catch { /* non-JSON */ }
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? (data.message as string[]).join(', ') : (data.message as string) ?? text.slice(0, 300)
    return NextResponse.json({ error: msg || 'Errore GHL' }, { status: res.status })
  }

  // Mirror into the cache immediately so the new member shows without waiting for sync
  const newId = (data.id as string) ?? (data.user as { id?: string } | undefined)?.id
  if (newId) {
    const sb = createAdminClient()
    await sb.from('bellessere_users').upsert({
      id: newId, location_id: BELLESSERE_LOCATION_ID,
      name: `${input.firstName} ${input.lastName}`.trim(),
      email: input.email, phone: input.phone ?? null, synced_at: new Date().toISOString(),
    }, { onConflict: 'id' })
  }

  // AWAIT a fast users-only sync so the roster cache is authoritative before we
  // respond (covers any id-shape mismatch in the create response above). The
  // heavier full sync (calendars + the auto-created personal calendar/schedule)
  // runs in the background.
  await import('@/lib/bellessere/sync').then(m => m.syncBellessere('users')).catch(() => {})
  import('@/lib/bellessere/sync').then(m => m.syncBellessere('all')).catch(() => {})

  // Provision the new member's login immediately (auth user + profile +
  // profile_locations) so they never hit the invite-only gate while waiting for
  // the GHL webhook / hourly cron. Targeted + fast — not a full-location sync.
  await provisionMemberLogin(input.email, 'user').catch(() => {})

  return NextResponse.json({ id: newId, ok: true })
}

// DELETE — remove a GHL user, then drop from cache
export async function DELETE(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const werr = await assertBellessereWrite()
  if (werr) return werr

  const { userId } = await req.json().catch(() => ({})) as { userId?: string }
  if (!userId) return NextResponse.json({ error: 'userId obbligatorio' }, { status: 400 })

  const { token } = await getConn()
  const res = await fetch(`${GHL}/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, Version: V },
  })
  if (!(res.status === 200 || res.status === 204)) {
    const d = await res.json().catch(() => ({}))
    const msg = Array.isArray(d.message) ? d.message.join(', ') : (d.message ?? 'Errore GHL')
    return NextResponse.json({ error: msg }, { status: res.status })
  }

  const sb = createAdminClient()
  // Capture the member's email BEFORE dropping the roster row, so we can revoke
  // their dashboard login too — removing from the team = can no longer sign in.
  const { data: removed } = await sb.from('bellessere_users').select('email').eq('id', userId).maybeSingle()
  await sb.from('bellessere_users').delete().eq('location_id', BELLESSERE_LOCATION_ID).eq('id', userId)
  await sb.from('bellessere_schedules').delete().eq('location_id', BELLESSERE_LOCATION_ID).eq('user_id', userId)
  if (removed?.email) await revokeMemberLogin(removed.email).catch(() => {})

  return NextResponse.json({ ok: true })
}
