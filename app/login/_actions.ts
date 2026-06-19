'use server'

import { createAdminClient } from '@/lib/supabase-server'

const GHL_BASE = 'https://services.leadconnectorhq.com'

export type LoginCheck = { allowed: true } | { error: string }

/**
 * Invite-only gate. Returns whether an email is permitted to receive a login
 * link — it does NOT send the link.
 *
 * The magic link is sent from the browser (see login/page.tsx) so the PKCE
 * code_verifier cookie is written client-side and survives the round-trip to
 * /api/auth/callback. Sending from a server action wrote the verifier on the
 * action's response, where it was dropped before the callback ran — the cause
 * of the "link expired on first click, works on second" bug.
 */
export async function checkLoginAllowed(email: string): Promise<LoginCheck> {
  const emailLower = email?.trim().toLowerCase()
  if (!emailLower) return { error: 'Email is required' }

  const supabaseAdmin = createAdminClient()

  // Step 0: known user (super_admin / admin / agency member). limit(1) instead
  // of single() so a duplicate row never throws this into the invite-only path.
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, role, agency_id')
    .eq('email', emailLower)
    .limit(1)
  const profile = profiles?.[0]

  if (profile) {
    // Block deactivated accounts (their auth user is banned).
    const { data: au } = await supabaseAdmin.auth.admin.getUserById(profile.id)
    const bannedUntil = (au?.user as { banned_until?: string } | undefined)?.banned_until
    if (bannedUntil && new Date(bannedUntil).getTime() > Date.now()) {
      return { error: 'This account has been deactivated. Please contact your administrator.' }
    }
    return { allowed: true }
  }

  const token = process.env.GHL_AGENCY_TOKEN
  const companyId = process.env.GHL_COMPANY_ID
  if (!token || !companyId) return { error: 'Server configuration error' }

  const headers = { Authorization: `Bearer ${token}`, Version: '2021-07-28' }

  // Step 1: known GHL user at the agency (company) level.
  try {
    const res = await fetch(
      `${GHL_BASE}/users/search?companyId=${companyId}&email=${encodeURIComponent(emailLower)}&limit=1`,
      { headers, cache: 'no-store' }
    )
    if (res.ok) {
      const data = await res.json()
      if (((data?.users ?? []) as unknown[]).length > 0) {
        return { allowed: true }
      }
    }
  } catch { /* fall through */ }

  // Step 2: known GHL user on a per-location OAuth connection.
  const { data: connections } = await supabaseAdmin
    .from('ghl_connections')
    .select('location_id, company_id, access_token, refresh_token')
    .not('refresh_token', 'is', null)
    .limit(50)

  for (const conn of connections ?? []) {
    try {
      const locCompanyId = conn.company_id ?? companyId
      const res = await fetch(
        `${GHL_BASE}/users/search?companyId=${locCompanyId}&locationId=${conn.location_id}&limit=100`,
        {
          headers: { Authorization: `Bearer ${conn.access_token}`, Version: '2021-07-28' },
          cache: 'no-store',
        }
      )
      if (!res.ok) continue
      const data = await res.json()
      const users = (data?.users ?? []) as { email?: string }[]
      if (users.some((u) => u.email?.toLowerCase() === emailLower)) {
        return { allowed: true }
      }
    } catch { continue }
  }

  // Invite-only: unknown emails cannot self-register. Existing admins/agency
  // members (matched above) pass; new agencies are onboarded via an invite.
  return { error: 'No account found for this email. GHL Custom Dash is invite-only — contact us to get set up.' }
}
