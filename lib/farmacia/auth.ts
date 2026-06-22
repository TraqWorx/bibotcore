import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { canAccessBibotDesign } from '@/lib/auth/designOwner'
import { FARMACIA_LOCATION_ID } from '@/lib/farmacia/fields'

export interface FarmaciaSession {
  email: string
  userId: string
  role: 'owner'
}

/**
 * Resolve the signed-in user for the Farmacia design. Owner = super_admin,
 * admin, or any Bibot-agency member (the pharmacy is run from Bibot). Anyone
 * else is bounced to /login. Simpler than Apulia — no amministratore role.
 */
export const getFarmaciaSession = cache(async (): Promise<FarmaciaSession> => {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  const dest = '/login?next=/designs/farmacia-cialdella/dashboard'
  if (!user?.email) redirect(dest)

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('role, agency_id, location_id').eq('id', user.id).single()
  // Access = super_admin, a Bibot admin, or a user assigned to the Farmacia
  // location. Other agencies' admins and Bibot members not assigned to this
  // location must not see pharmacy data.
  if (!(await canAccessBibotDesign(user.id, profile, FARMACIA_LOCATION_ID))) redirect(dest)

  return { email: user.email, userId: user.id, role: 'owner' }
})
