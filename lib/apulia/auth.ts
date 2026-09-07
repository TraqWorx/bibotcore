import { redirect } from 'next/navigation'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { canAccessBibotDesign } from '@/lib/auth/designOwner'

export const APULIA_IMPERSONATE_COOKIE = 'ap_impersonate'

export const APULIA_LOCATION_ID = 'VtNhBfleEQDg0KX4eZqY'
export const APULIA_AGENCY_ID = 'e7b3d0d8-5682-44d5-87c1-c449e6814f15'

export type ApuliaRole = 'owner' | 'amministratore'

export interface ApuliaSession {
  email: string
  userId: string
  role: ApuliaRole
  /** Set only when role === 'amministratore'. Joins to POD contacts on this code. */
  codiceAmministratore?: string
  /** GHL contact ID of the admin's contact record (for /amministratori drill-down link). */
  contactId?: string
  /** True when the owner is impersonating an amministratore via the "View as" feature. */
  impersonating?: boolean
}

/**
 * Resolve the signed-in user into an Apulia-specific role + scope.
 * Owner = profile.role 'admin' or 'super_admin' on Apulia's agency.
 * Amministratore = email matches a contact tagged 'amministratore' on Apulia.
 * Anyone else gets redirected to /login.
 */
export const getApuliaSession = cache(async (): Promise<ApuliaSession> => {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user?.email) redirect('/login?next=/designs/apulia-power/dashboard')

  const sb = createAdminClient()
  const { data: profile } = await sb
    .from('profiles')
    .select('role, agency_id, location_id')
    .eq('id', user.id)
    .single()

  // Owner detection — super_admin, a Bibot admin, or a user assigned to the
  // Apulia location. A bare admin role on another agency, or merely belonging to
  // the Bibot agency without being assigned to Apulia's location, is NOT enough.
  const isOwner = await canAccessBibotDesign(user.id, profile, APULIA_LOCATION_ID)

  if (isOwner) {
    // If owner has set the impersonation cookie, render the design as that
    // amministratore so they can preview the personal view exactly as that
    // admin would see it. Owner can clear via /designs/apulia-power/exit-impersonation.
    const cookieStore = await cookies()
    const impersonateContactId = cookieStore.get(APULIA_IMPERSONATE_COOKIE)?.value
    if (impersonateContactId) {
      const sb2 = createAdminClient()
      const { data: target } = await sb2
        .from('apulia_contacts')
        .select('id, codice_amministratore, email')
        .eq('id', impersonateContactId)
        .eq('is_amministratore', true)
        .maybeSingle()
      if (target) {
        return {
          email: target.email ?? user.email,
          userId: user.id,
          role: 'amministratore',
          codiceAmministratore: target.codice_amministratore ?? undefined,
          contactId: target.id,
          impersonating: true,
        }
      }
    }
    return { email: user.email, userId: user.id, role: 'owner' }
  }

  // Amministratore: resolved from apulia_contacts, which is the source of truth
  // for this design. The GHL 'amministratore' tag is NOT reliable — most admin
  // records carry the flag in the DB but no tag in GHL, and gating on the tag
  // locked the majority of them out.
  const { data: ammin } = await sb
    .from('apulia_contacts')
    .select('id, codice_amministratore')
    .eq('is_amministratore', true)
    .ilike('email', user.email)
    .limit(1)
  const contact = ammin?.[0]
  if (!contact) {
    redirect('/login?error=not_authorized&email=' + encodeURIComponent(user.email))
  }

  return {
    email: user.email,
    userId: user.id,
    role: 'amministratore',
    codiceAmministratore: contact.codice_amministratore ? String(contact.codice_amministratore) : undefined,
    contactId: contact.id,
  }
})
