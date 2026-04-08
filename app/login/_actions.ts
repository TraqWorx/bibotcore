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

  // Step 0: Allow known users through immediately (super_admin, admin, or agency members)
  const supabaseAdmin = createAdminClient()
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, agency_id')
    .eq('email', emailLower)
    .single()

  if (profile) {
    return sendMagicLink(email)
  }

  // Step 1: Check if email exists as a GHL user (agency-level)
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

  // Step 2: Check per-location OAuth connections
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
        return sendMagicLink(email)
      }
    } catch { continue }
  }

  // New user — allow through, redirect page will auto-create their account
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
