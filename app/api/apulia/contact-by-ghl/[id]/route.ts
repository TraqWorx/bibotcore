import { NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { canAccessBibotDesign } from '@/lib/auth/designOwner'
import { APULIA_LOCATION_ID } from '@/lib/apulia/fields'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role, location_id').eq('id', user.id).single()
  if (!(await canAccessBibotDesign(user.id, profile, APULIA_LOCATION_ID))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: ghlId } = await params
  const { data } = await sb
    .from('apulia_contacts')
    .select('id, ghl_id, first_name, last_name, email, phone, tags, custom_fields, amministratore_name, codice_amministratore, pod_pdr, comune, is_amministratore, is_switch_out')
    .eq('ghl_id', ghlId)
    .neq('sync_status', 'pending_delete')
    .maybeSingle()

  return NextResponse.json({ contact: data ?? null })
}
