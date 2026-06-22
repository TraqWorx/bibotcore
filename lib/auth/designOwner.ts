import { isBibotAgency } from '@/lib/isBibotAgency'

/**
 * Owner check for Bibot's bespoke single-tenant client designs (Apulia Power,
 * Farmacia Cialdella). These designs are operated BY Bibot, so the only accounts
 * allowed to see their data are the platform owner (super_admin) or a member of
 * the Bibot agency.
 *
 * IMPORTANT: a bare `role === 'admin'` is NOT sufficient — every paying agency
 * owner has role 'admin', so accepting it would let any agency read another
 * business's customers/payments. Always scope admins to the Bibot agency.
 */
export function isBibotDesignOwner(
  profile: { role?: string | null; agency_id?: string | null } | null | undefined,
): boolean {
  if (!profile) return false
  if (profile.role === 'super_admin') return true
  return (
    !!profile.agency_id &&
    isBibotAgency(profile.agency_id) &&
    (profile.role === 'admin' || profile.role === 'agency')
  )
}
