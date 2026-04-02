import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

/**
 * POST /api/portal/verify
 * Verifies that an email belongs to a cached contact in the given location.
 * Called before sending the OTP to prevent unauthorized signups.
 *
 * Security: Does NOT return contact IDs or any identifying info.
 * Only returns ok: true/false.
 */
export async function POST(request: Request) {
  const body = await request.json()
  const email = (body.email as string)?.trim().toLowerCase()
  const locationId = body.locationId as string

  if (!email || !locationId) {
    return NextResponse.json({ error: 'Email e location richiesti' }, { status: 400 })
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Formato email non valido' }, { status: 400 })
  }

  const sb = createAdminClient()

  // Verify the location exists
  const { data: location } = await sb
    .from('locations')
    .select('location_id')
    .eq('location_id', locationId)
    .limit(1)
    .maybeSingle()

  if (!location) {
    return NextResponse.json({ error: 'Accesso non disponibile' }, { status: 404 })
  }

  // Check if portal is enabled — same generic error to prevent enumeration
  const { data: moduleSettings } = await sb
    .from('location_design_settings')
    .select('module_overrides')
    .eq('location_id', locationId)
    .maybeSingle()
  const overrides = (moduleSettings?.module_overrides ?? {}) as Record<string, { enabled?: boolean }>
  if (overrides.portal?.enabled === false) {
    return NextResponse.json({ error: 'Accesso non disponibile' }, { status: 404 })
  }

  // Check if this email exists as a contact in the cached contacts
  const { data: contact } = await sb
    .from('cached_contacts')
    .select('ghl_id')
    .eq('location_id', locationId)
    .ilike('email', email)
    .limit(1)
    .maybeSingle()

  if (!contact) {
    return NextResponse.json({ error: 'Accesso non disponibile' }, { status: 404 })
  }

  // Do NOT return contactGhlId — portal layout will resolve it after auth
  return NextResponse.json({ ok: true })
}
