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

  // Existing user — route by role
  if (profile) {
    if (profile.role === 'super_admin') redirect('/platform')
    if (profile.role === 'admin') redirect('/admin')
    if (profile.role === 'agency') redirect('/agency')
    redirect('/agency')
  }

  // New user — auto-create agency + profile with admin role
  const email = user.email ?? ''
  const agencyName = email.split('@')[1]?.split('.')[0] ?? 'My Agency'
  const displayName = agencyName.charAt(0).toUpperCase() + agencyName.slice(1)

  const { data: newAgency } = await supabase
    .from('agencies')
    .insert({
      name: displayName,
      email,
      owner_user_id: user.id,
    })
    .select('id')
    .single()

  if (newAgency) {
    await supabase.from('profiles').upsert({
      id: user.id,
      email,
      role: 'admin',
      agency_id: newAgency.id,
    }, { onConflict: 'id' })
  }

  redirect('/admin')
}
