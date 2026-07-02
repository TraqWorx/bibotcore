import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccessFast } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'
import { validateNewUser, buildCreateUserPayload } from '@/lib/bellessere/query'

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
  return NextResponse.json({ members })
}

// POST — create a GHL user, assign to the location, then re-sync the roster
export async function POST(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

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

  return NextResponse.json({ id: newId, ok: true })
}

// DELETE — remove a GHL user, then drop from cache
export async function DELETE(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

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
  await sb.from('bellessere_users').delete().eq('location_id', BELLESSERE_LOCATION_ID).eq('id', userId)
  await sb.from('bellessere_schedules').delete().eq('location_id', BELLESSERE_LOCATION_ID).eq('user_id', userId)

  return NextResponse.json({ ok: true })
}
