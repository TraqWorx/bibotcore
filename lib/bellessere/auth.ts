import { redirect } from 'next/navigation'
import { cache } from 'react'
import { NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { canAccessBibotDesign, canWriteBibotDesign } from '@/lib/auth/designOwner'
import { BELLESSERE_LOCATION_ID } from './constants'

export interface BellessereSession {
  email: string
  userId: string
}

export const getBellessereSession = cache(async (): Promise<BellessereSession> => {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  const dest = '/login?next=/designs/bellessere/dashboard'
  if (!user?.email) redirect(dest)

  const sb = createAdminClient()
  const { data: profile } = await sb
    .from('profiles')
    .select('role, agency_id, location_id')
    .eq('id', user.id)
    .single()

  if (!(await canAccessBibotDesign(user.id, profile, BELLESSERE_LOCATION_ID))) redirect(dest)

  return { email: user.email, userId: user.id }
})

/**
 * Guard for mutating Bellessere API handlers. Returns a 401/403 response when the
 * caller may not write (only super_admin, a Bibot admin, or a `location_admin`
 * may modify data — a `team_member` gets view-only), or null when allowed.
 */
export async function assertBellessereWrite(): Promise<NextResponse | null> {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = createAdminClient()
  const { data: profile } = await sb
    .from('profiles')
    .select('role, agency_id, location_id')
    .eq('id', user.id)
    .single()
  if (!(await canWriteBibotDesign(user.id, profile, BELLESSERE_LOCATION_ID)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}
