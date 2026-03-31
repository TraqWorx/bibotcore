import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

/**
 * POST /api/portal/verify
 * Verifies that an email belongs to a cached contact in the given location.
 * Called before sending the OTP to prevent unauthorized signups.
 */
export async function POST(request: Request) {
  const body = await request.json()
  const email = (body.email as string)?.trim().toLowerCase()
  const locationId = body.locationId as string

  if (!email || !locationId) {
    return NextResponse.json({ error: 'Email e location richiesti' }, { status: 400 })
  }

  const sb = createAdminClient()

  // Check if this email exists as a contact in the cached contacts
  const { data: contact } = await sb
    .from('cached_contacts')
    .select('ghl_id')
    .eq('location_id', locationId)
    .ilike('email', email)
    .limit(1)
    .single()

  if (!contact) {
    return NextResponse.json(
      { error: 'Nessun account trovato con questa email' },
      { status: 404 },
    )
  }

  return NextResponse.json({ ok: true, contactGhlId: contact.ghl_id })
}
