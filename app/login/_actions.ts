'use server'

import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

const GHL_BASE = 'https://services.leadconnectorhq.com'

export async function requestMagicLink(
  email: string
): Promise<{ error?: string }> {
  if (!email) return { error: 'Email is required' }

  const token = process.env.GHL_AGENCY_TOKEN
  const companyId = process.env.GHL_COMPANY_ID

  if (!token || !companyId) {
    return { error: 'Server configuration error' }
  }

  const headers = { Authorization: `Bearer ${token}`, Version: '2021-07-28' }
  const emailLower = email.toLowerCase()

  // Step 0: Allow known users through immediately (super_admin or agency members)
  const supabaseAdmin = createAdminClient()
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, agency_id')
    .eq('email', emailLower)
    .single()

  if (profile?.role === 'super_admin' || profile?.agency_id) {
    return sendMagicLink(email)
  }

  // Step 1: Check agency-level users by email
  try {
    const res = await fetch(
      `${GHL_BASE}/users/search?companyId=${companyId}&email=${encodeURIComponent(email)}&limit=1`,
      { headers, cache: 'no-store' }
    )
    if (res.ok) {
      const data = await res.json()
      if (((data?.users ?? []) as unknown[]).length > 0) {
        return sendMagicLink(email)
      }
    }
  } catch { /* fall through */ }

  // Step 2: Use each location's OAuth token to query its users.
  // GHL requires companyId+locationId (email filter not allowed with locationId).
  const supabase = createAdminClient()
  const { data: connections } = await supabase
    .from('ghl_connections')
    .select('location_id, company_id, access_token, refresh_token')
    .not('refresh_token', 'is', null)
    .limit(50)

  let oauthChecksRan = false

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
      oauthChecksRan = true
      const data = await res.json()
      const users = (data?.users ?? []) as { email?: string }[]
      if (users.some((u) => u.email?.toLowerCase() === emailLower)) {
        return sendMagicLink(email)
      }
    } catch { continue }
  }

  // If we ran OAuth checks and none found the user → block
  if (oauthChecksRan) {
    return { error: 'This email is not authorized to access this platform.' }
  }

  // No OAuth-connected locations to verify against — can't confirm either way, allow through
  return sendMagicLink(email)
}

async function sendMagicLink(email: string): Promise<{ error?: string }> {
  const supabase = await createAuthClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    },
  })
  if (error) return { error: error.message }
  return {}
}
