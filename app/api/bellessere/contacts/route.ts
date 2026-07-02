import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'
import { parsePageParams, sanitizeSearch, contactSearchOr } from '@/lib/bellessere/query'

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

async function authCheck(req: NextRequest) {
  const access = await getLocationAccess(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

// GET — list contacts from cache (fast Supabase query, updated by webhooks in real-time)
export async function GET(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const sp = req.nextUrl.searchParams
  const search = sanitizeSearch(sp.get('search') ?? '')
  // Server-side pagination (default page 100) — removes the old hard 500 cap so
  // the client list scales to thousands of contacts.
  const { limit, offset } = parsePageParams(sp, 100, 500)

  const sb = createAdminClient()
  let query = sb
    .from('cached_contacts')
    .select('ghl_id, first_name, last_name, email, phone, tags', { count: 'exact' })
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .order('last_name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(contactSearchOr(search))
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const contacts = (data ?? []).map(c => ({
    id: c.ghl_id,
    firstName: c.first_name ?? '',
    lastName: c.last_name ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    tags: c.tags ?? [],
  }))

  // Optional aggregate stats for the Clienti header (requested once, not per page)
  let stats: { total: number; withEmail: number; withPhone: number; newThisMonth: number } | undefined
  if (sp.get('stats') === '1') {
    const base = () => sb.from('cached_contacts').select('*', { count: 'exact', head: true }).eq('location_id', BELLESSERE_LOCATION_ID)
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const [totalR, emailR, phoneR, newR] = await Promise.all([
      base(),
      base().not('email', 'is', null).neq('email', ''),
      base().not('phone', 'is', null).neq('phone', ''),
      base().gte('date_added', monthStart.toISOString()),
    ])
    stats = {
      total: totalR.count ?? 0,
      withEmail: emailR.count ?? 0,
      withPhone: phoneR.count ?? 0,
      newThisMonth: newR.count ?? 0,
    }
  }

  return NextResponse.json({
    contacts,
    total: count ?? contacts.length,
    hasMore: (count ?? 0) > offset + contacts.length,
    ...(stats ? { stats } : {}),
  }, {
    headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120' },
  })
}

// PUT — update contact fields (tags, name, etc.)
export async function PUT(req: NextRequest) {
  const access = await getLocationAccess(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { contactId, ...fields } = await req.json()
  if (!contactId) return NextResponse.json({ error: 'contactId required' }, { status: 400 })

  const token = await getToken()
  const res = await fetch(`${GHL}/contacts/${contactId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, Version: V, 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

// POST — create a contact in GHL
export async function POST(req: NextRequest) {
  const access = await getLocationAccess(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { firstName, lastName, email, phone, companyName, address1 } = await req.json()
  if (!firstName && !lastName && !phone && !email) {
    return NextResponse.json({ error: 'At least one of name, phone, or email is required' }, { status: 400 })
  }

  const token = await getToken()
  const res = await fetch(`${GHL}/contacts/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Version: V, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locationId: BELLESSERE_LOCATION_ID,
      firstName: firstName ?? '',
      lastName: lastName ?? '',
      email: email ?? '',
      phone: phone ?? '',
      companyName: companyName ?? '',
      address1: address1 ?? '',
    }),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
