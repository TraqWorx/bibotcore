import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'

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
  const isOwner =
    profile?.role === 'super_admin' ||
    profile?.role === 'admin' ||
    (!!profile?.agency_id && isBibotAgency(profile.agency_id))
  if (!isOwner) redirect(dest)

  return { email: user.email, userId: user.id, role: 'owner' }
})
