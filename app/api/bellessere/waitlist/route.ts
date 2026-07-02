import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccessFast } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'
import { inviteEntry, reconcileWaitlistBookings } from '@/lib/bellessere/waitlistActions'

export const dynamic = 'force-dynamic'

const GHL = 'https://services.leadconnectorhq.com'
const V = '2021-07-28'

async function getToken(): Promise<string> {
  const sb = createAdminClient()
  const { data: conn } = await sb
    .from('ghl_connections')
    .select('access_token, refresh_token, expires_at, company_id')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .single()
  if (!conn) throw new Error('No GHL connection for Bellessere')
  return refreshIfNeeded(BELLESSERE_LOCATION_ID, conn)
}

async function requireAuth(req: NextRequest) {
  const access = await getLocationAccessFast(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

interface SlotInput { preferredDate?: string; timePref?: string; preferredFrom?: string; preferredTo?: string }

// POST — PUBLIC: a customer joins the waiting list (called from the token-less page).
// One row is created per preferred day (each with its own time preference).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { firstName, lastName, phone, email, calendarId, serviceName, operatorId, note } = body as Record<string, string>

  // Accept a `slots` array (multi-day) or fall back to a single day for compatibility
  const rawSlots: SlotInput[] = Array.isArray(body.slots) && body.slots.length > 0
    ? body.slots
    : [{ preferredDate: body.preferredDate, timePref: body.timePref, preferredFrom: body.preferredFrom, preferredTo: body.preferredTo }]

  if (!firstName?.trim()) return NextResponse.json({ error: 'Nome obbligatorio' }, { status: 400 })
  if (!phone?.trim() && !email?.trim()) return NextResponse.json({ error: 'Telefono o email obbligatori' }, { status: 400 })
  if (email && !EMAIL_RE.test(email)) return NextResponse.json({ error: 'Email non valida' }, { status: 400 })
  if (!calendarId) return NextResponse.json({ error: 'Servizio obbligatorio' }, { status: 400 })

  const slots = rawSlots.filter(s => s.preferredDate).slice(0, 30)
  if (slots.length === 0) return NextResponse.json({ error: 'Giorno preferito obbligatorio' }, { status: 400 })

  const sb = createAdminClient()

  // Upsert a GHL contact so we can message them later
  let contactId: string | null = null
  try {
    const token = await getToken()
    const res = await fetch(`${GHL}/contacts/upsert`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Version: V, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId: BELLESSERE_LOCATION_ID,
        firstName: firstName ?? '', lastName: lastName ?? '',
        phone: phone ?? '', email: email ?? '',
      }),
    })
    const d = await res.json().catch(() => ({}))
    contactId = d?.contact?.id ?? d?.id ?? null
  } catch { /* still record the entry even if contact upsert fails */ }

  const rows = slots.map(s => {
    const tp = ['any', 'morning', 'afternoon', 'specific'].includes(s.timePref ?? '') ? s.timePref : 'any'
    return {
      location_id: BELLESSERE_LOCATION_ID,
      contact_ghl_id: contactId,
      first_name: firstName ?? null, last_name: lastName ?? null,
      phone: phone ?? null, email: email ?? null,
      calendar_id: calendarId, service_name: serviceName ?? null,
      operator_id: operatorId || null,
      preferred_date: s.preferredDate,
      time_pref: tp,
      preferred_from: tp === 'specific' ? (s.preferredFrom || null) : null,
      preferred_to: tp === 'specific' ? (s.preferredTo || null) : null,
      note: note ?? null,
      status: 'waiting',
    }
  })

  const { error } = await sb.from('bellessere_waitlist').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, count: rows.length })
}

// GET — AUTH: list entries for the admin module
export async function GET(req: NextRequest) {
  const err = await requireAuth(req)
  if (err) return err

  // Catch bookings the AppointmentCreate webhook may have missed
  await reconcileWaitlistBookings().catch(() => {})

  const status = req.nextUrl.searchParams.get('status')
  const sb = createAdminClient()
  let q = sb.from('bellessere_waitlist')
    .select('*')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .order('created_at', { ascending: true })
  if (status && status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}

// PATCH — AUTH: invite an entry (send SMS), or mark it booked manually
export async function PATCH(req: NextRequest) {
  const err = await requireAuth(req)
  if (err) return err

  const { id, action } = await req.json().catch(() => ({})) as { id?: string; action?: string }
  if (!id) return NextResponse.json({ error: 'id obbligatorio' }, { status: 400 })

  if (action === 'booked') {
    const sb = createAdminClient()
    const { error } = await sb.from('bellessere_waitlist')
      .update({ status: 'booked', updated_at: new Date().toISOString() })
      .eq('location_id', BELLESSERE_LOCATION_ID).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const result = await inviteEntry(id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — AUTH: remove / cancel an entry
export async function DELETE(req: NextRequest) {
  const err = await requireAuth(req)
  if (err) return err

  const { id } = await req.json().catch(() => ({})) as { id?: string }
  if (!id) return NextResponse.json({ error: 'id obbligatorio' }, { status: 400 })

  const sb = createAdminClient()
  const { error } = await sb.from('bellessere_waitlist')
    .delete().eq('location_id', BELLESSERE_LOCATION_ID).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
