import { redirect } from 'next/navigation'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

export default async function RedirectPage() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) redirect('/login')

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, agency_id')
    .eq('id', user.id)
    .single()

  console.log('[redirect]', user.email, 'role:', profile?.role, 'agency_id:', profile?.agency_id)

  // Super admin → platform
  if (profile?.role === 'super_admin') {
    console.log('[redirect] → /platform')
    redirect('/platform')
  }

  // Agency owner → admin panel
  if (profile?.agency_id) {
    const { data: agency } = await supabase
      .from('agencies')
      .select('owner_user_id')
      .eq('id', profile.agency_id)
      .single()

    console.log('[redirect] agency owner:', agency?.owner_user_id, 'user:', user.id, 'match:', agency?.owner_user_id === user.id)

    if (agency?.owner_user_id === user.id) {
      console.log('[redirect] → /admin')
      redirect('/admin')
    }
  }

  // Everyone else → location picker
  console.log('[redirect] → /agency')
  redirect('/agency')
}
