import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

/**
 * POST /api/portal/test-access
 * Creates a temporary portal_users mapping so the admin can preview the portal.
 * Maps the current admin user to the first contact in the location.
 */
export async function POST(req: NextRequest) {
  const { locationId } = await req.json()
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const sb = createAdminClient()

  // Verify user is admin
  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'super_admin' && profile.role !== 'location_admin')) {
    return NextResponse.json({ error: 'Solo gli admin possono usare l\'anteprima' }, { status: 403 })
  }

  // Check if mapping already exists
  const { data: existing } = await sb
    .from('portal_users')
    .select('contact_ghl_id')
    .eq('auth_user_id', user.id)
    .eq('location_id', locationId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, contactId: existing.contact_ghl_id })
  }

  // Find first contact in this location to map to
  const { data: contact } = await sb
    .from('cached_contacts')
    .select('ghl_id, first_name, last_name')
    .eq('location_id', locationId)
    .order('date_added', { ascending: false })
    .limit(1)
    .single()

  if (!contact) {
    return NextResponse.json({ error: 'Nessun contatto trovato in questa location. Sincronizza prima i contatti.' }, { status: 404 })
  }

  // Create the mapping
  const { error } = await sb.from('portal_users').upsert(
    {
      auth_user_id: user.id,
      location_id: locationId,
      contact_ghl_id: contact.ghl_id,
    },
    { onConflict: 'auth_user_id' },
  )

  if (error) {
    return NextResponse.json({ error: 'Errore creazione accesso: ' + error.message }, { status: 500 })
  }

  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'contatto'
  return NextResponse.json({ ok: true, contactId: contact.ghl_id, contactName: name })
}
