import { cookies } from 'next/headers'
import { cache } from 'react'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

export const VIEW_AS_AGENCY_COOKIE = 'sa_view_agency'

export interface AdminContext {
  userId: string
  role: string | null
  /** The agency whose data the admin pages should show */
  agencyId: string | null
  /** Set when a super admin is looking at someone else's agency */
  viewingAsName: string | null
}

/**
 * Who the admin pages are acting as. A super admin can open another agency's
 * panel; everyone else only ever sees their own agency.
 */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return null

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('role, agency_id').eq('id', user.id).single()
  if (!profile) return null

  const base: AdminContext = { userId: user.id, role: profile.role, agencyId: profile.agency_id, viewingAsName: null }
  if (profile.role !== 'super_admin') return base

  const viewing = (await cookies()).get(VIEW_AS_AGENCY_COOKIE)?.value
  if (!viewing) return base

  const { data: agency } = await sb.from('agencies').select('id, name').eq('id', viewing).maybeSingle()
  if (!agency) return base
  return { ...base, agencyId: agency.id, viewingAsName: agency.name }
})
