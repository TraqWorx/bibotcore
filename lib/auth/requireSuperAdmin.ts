import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

/**
 * Throws unless the caller is a platform super_admin.
 *
 * Use this INSIDE server actions and route handlers. A layout/page guard does
 * NOT protect a server action — actions are POST endpoints that can be invoked
 * directly, bypassing the page that rendered them, so privileged mutations must
 * re-verify the caller themselves.
 */
export async function requireSuperAdmin(): Promise<void> {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') throw new Error('Not authorized')
}
