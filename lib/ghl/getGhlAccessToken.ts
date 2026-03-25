import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { refreshIfNeeded } from './refreshIfNeeded'

export interface GhlContext {
  accessToken: string
  locationId: string
}

/**
 * Session-based token getter. Uses the current user's first active install location.
 * Only used by marketplace.ts (admin GHL sync). CRM pages use getGhlClient(locationId) instead.
 */
export async function getGhlAccessToken(): Promise<GhlContext> {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  // Use installs (not profiles) to find the user's location
  const { data: install } = await supabase
    .from('installs')
    .select('location_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!install?.location_id) throw new Error('User has no connected location')

  const { data: connection } = await supabase
    .from('ghl_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('location_id', install.location_id)
    .single()

  if (!connection?.access_token) throw new Error('GHL connection not found')

  const accessToken = await refreshIfNeeded(install.location_id, connection)
  return { accessToken, locationId: install.location_id }
}
