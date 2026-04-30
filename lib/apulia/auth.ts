import { redirect } from 'next/navigation'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

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

  // Owner detection — broad: anyone with platform-level access OR an
  // explicit admin-like role on Apulia. Prevents false 403s for users
  // whose agency_id is null (super_admin) or whose Bibot record stored
  // them under a different agency.
  const isOwner =
    profile?.role === 'super_admin' ||
    profile?.role === 'admin' ||
    (profile?.location_id === APULIA_LOCATION_ID && profile?.role === 'agency') ||
    profile?.agency_id === APULIA_AGENCY_ID

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

  // Amministratore: search Apulia contacts where email matches.
  const { data: conn } = await sb.from('ghl_connections').select('access_token').eq('location_id', APULIA_LOCATION_ID).single()
  if (!conn) {
    return { email: user.email, userId: user.id, role: 'amministratore' }
  }

  const r = await fetch('https://services.leadconnectorhq.com/contacts/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${conn.access_token}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locationId: APULIA_LOCATION_ID,
      filters: [{ field: 'email', operator: 'eq', value: user.email }],
      pageLimit: 1,
    }),
    cache: 'no-store',
  })
  let contact: { id: string; tags?: string[]; customFields?: { id: string; value?: string }[] } | undefined
  if (r.ok) {
    const j = (await r.json()) as { contacts?: typeof contact[] }
    contact = j.contacts?.[0]
  }
  const isAmministratore = contact?.tags?.includes('amministratore')
  if (!isAmministratore) {
    redirect('/login?error=not_authorized&email=' + encodeURIComponent(user.email))
  }

  const codice = contact?.customFields?.find((f) => f.id === '3VwwjdaKH8oQgUO1Vwih')?.value
  return {
    email: user.email,
    userId: user.id,
    role: 'amministratore',
    codiceAmministratore: codice ? String(codice) : undefined,
    contactId: contact?.id,
  }
})
