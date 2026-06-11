'use server'

import { createAdminClient, createAuthClient } from '@/lib/supabase-server'

async function requireSuperAdmin() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') throw new Error('Not authorized')
}

/**
 * Invite a new agency admin by email. They receive a Supabase invite link;
 * on first login `/redirect` provisions their agency + admin profile.
 */
export async function inviteAdmin(email: string): Promise<{ error?: string; ok?: boolean }> {
  try {
    await requireSuperAdmin()
    const e = (email || '').trim().toLowerCase()
    if (!e || !e.includes('@')) return { error: 'Valid email required' }
    const sb = createAdminClient()
    const { data, error } = await sb.auth.admin.inviteUserByEmail(e, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    })
    if (error) return { error: error.message }
    // Server-set marker (app_metadata, not user-forgeable) so /redirect provisions
    // their agency + admin on first login. Without it, profile-less users are refused.
    if (data?.user) {
      await sb.auth.admin.updateUserById(data.user.id, { app_metadata: { invited_admin: true } })
    }
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to invite' }
  }
}
