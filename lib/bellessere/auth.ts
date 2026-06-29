import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { canAccessBibotDesign } from '@/lib/auth/designOwner'
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
