import { redirect } from 'next/navigation'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { designSlugToFolder } from '@/lib/designs/slugMap'

export default async function RedirectPage() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) redirect('/login')

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, agency_id, location_id')
    .eq('id', user.id)
    .maybeSingle()

  // Existing user — route by role
  if (profile) {
    if (profile.role === 'super_admin') redirect('/platform')
    if (profile.role === 'admin') redirect('/admin')

    // Design members (e.g. salon staff) belong to a single installed design —
    // send them straight to its dashboard instead of the generic agency view.
    const { data: memberLocs } = await supabase
      .from('profile_locations').select('location_id').eq('user_id', user.id)
    const locIds = [...new Set([
      ...(memberLocs ?? []).map((r) => r.location_id),
      ...(profile.location_id ? [profile.location_id] : []),
    ])]
    if (locIds.length > 0) {
      const { data: designInstalls } = await supabase
        .from('installs').select('design_slug').in('location_id', locIds).not('design_slug', 'is', null)
      const slugs = [...new Set((designInstalls ?? []).map((i) => i.design_slug).filter(Boolean))]
      if (slugs.length === 1) redirect(`/designs/${designSlugToFolder(slugs[0] as string)}`)
    }

    redirect('/agency')
  }

  // No profile under this auth id, but a profile already exists for this email
  // (id drifted from the auth user). This is a real account, not an uninvited
  // one — never show the invite-only wall or auto-provision a second agency.
  if (user.email) {
    const { data: byEmail } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('email', user.email.toLowerCase())
      .limit(1)
    if (byEmail?.[0]) {
      console.error(
        `[redirect] profile id mismatch for ${user.email}: auth ${user.id} vs profile ${byEmail[0].id}`
      )
      redirect('/login?message=' + encodeURIComponent(
        'We found your account but it needs to be re-linked. Please contact us to finish signing in.'
      ))
    }
  }

  // No profile: invite-only. Only provision an agency + admin for users who were
  // explicitly invited (server-set app_metadata, which the user cannot forge —
  // user_metadata would be editable by the account holder). This blocks the
  // portal-OTP → /redirect self-provisioning bypass.
  const invited = (user.app_metadata as Record<string, unknown> | undefined)?.invited_admin === true
  if (!invited) {
    redirect('/login?message=' + encodeURIComponent('Access is invite-only — contact us to get set up.'))
  }

  // Invited user — auto-create agency + profile with admin role
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
