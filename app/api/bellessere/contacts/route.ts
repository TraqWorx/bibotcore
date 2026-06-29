import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

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
