import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotDesignOwner } from '@/lib/auth/designOwner'

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
  const { data: profile } = await sb.from('profiles').select('role, agency_id').eq('id', user.id).single()
  // Owner = platform super_admin or a Bibot-agency member. A bare admin role is
  // NOT enough — that would let any other agency's owner read pharmacy data.
  if (!isBibotDesignOwner(profile)) redirect(dest)

  return { email: user.email, userId: user.id, role: 'owner' }
})
