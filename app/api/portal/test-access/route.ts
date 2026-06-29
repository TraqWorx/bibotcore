import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'

/**
 * POST /api/portal/test-access
 * Creates a temporary portal_users mapping so the admin can preview the portal.
 * Maps the current admin user to the first contact in the location.
 */
export async function POST(req: NextRequest) {
  const { locationId } = await req.json()
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const access = await getLocationAccess(req, locationId)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = createAdminClient()

  const [{ data: profile }, { data: membership }] = await Promise.all([
    sb.from('profiles').select('role').eq('id', access.userId).single(),
    sb.from('profile_locations').select('role').eq('user_id', access.userId).eq('location_id', locationId).maybeSingle(),
  ])

  const canPreview =
    profile?.role === 'super_admin' ||
    profile?.role === 'admin' ||
    membership?.role === 'location_admin'

  if (!canPreview) {
    return NextResponse.json({ error: 'Solo gli admin possono usare l\'anteprima' }, { status: 403 })
  }

  // Check if mapping already exists
  const { data: existing } = await sb
    .from('portal_users')
    .select('contact_ghl_id')
    .eq('auth_user_id', access.userId)
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
      auth_user_id: access.userId,
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
