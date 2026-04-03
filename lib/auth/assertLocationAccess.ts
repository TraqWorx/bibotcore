/**
 * Reusable location access guard for API routes.
 * Verifies the authenticated user has access to the requested locationId.
 * Returns a structured result so handlers can distinguish 401 vs 403.
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase-server'

export interface AuthorizedLocationAccess {
  userId: string
  email: string
  isSuperAdmin: boolean
}

export type LocationAccessResult =
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | ({ status: 'authorized' } & AuthorizedLocationAccess)

export async function getLocationAccess(
  req: NextRequest,
  locationId: string,
): Promise<LocationAccessResult> {
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { status: 'unauthenticated' }

  const sb = createAdminClient()

  // Check profile + membership in parallel
  const [{ data: profile }, { data: membership }] = await Promise.all([
    sb.from('profiles').select('role').eq('id', user.id).single(),
    sb.from('profile_locations').select('role').eq('user_id', user.id).eq('location_id', locationId).maybeSingle(),
  ])

  const isSuperAdmin = profile?.role === 'super_admin'

  // Super admin has access to everything
  if (isSuperAdmin) {
    return { status: 'authorized', userId: user.id, email: user.email ?? '', isSuperAdmin: true }
  }

  // Check membership
  if (membership) {
    return { status: 'authorized', userId: user.id, email: user.email ?? '', isSuperAdmin: false }
  }

  // Fallback: check installs table (backward compat)
  const { data: install } = await sb
    .from('installs')
    .select('location_id')
    .eq('user_id', user.id)
    .eq('location_id', locationId)
    .maybeSingle()

  if (install) {
    return { status: 'authorized', userId: user.id, email: user.email ?? '', isSuperAdmin: false }
  }

  return { status: 'forbidden' }
}

export async function assertLocationAccess(
  req: NextRequest,
  locationId: string,
): Promise<AuthorizedLocationAccess | null> {
  const result = await getLocationAccess(req, locationId)
  if (result.status !== 'authorized') return null
  return result
}
