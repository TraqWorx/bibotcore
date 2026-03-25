'use server'

import { createAdminClient, createAuthClient } from '@/lib/supabase-server'

async function assertSuperAdmin() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') throw new Error('Not authorized')
}

export async function generateLoginLink(
  userId: string
): Promise<{ url: string } | { error: string }> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single()

    if (!profile?.email) return { error: 'User email not found' }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
      options: { redirectTo: '/agency' },
    })

    if (error || !data.properties?.action_link) {
      return { error: error?.message ?? 'Failed to generate link' }
    }

    return { url: data.properties.action_link }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to generate link' }
  }
}
