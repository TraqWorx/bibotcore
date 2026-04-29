'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { refreshGhlToken } from '@/lib/ghl/refreshGhlToken'

async function ensureBibot(): Promise<{ error: string } | undefined> {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id').eq('id', user.id).single()
  if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) return { error: 'Forbidden' }
}

export async function refreshConnection(locationId: string): Promise<{ error: string } | undefined> {
  const guard = await ensureBibot()
  if (guard) return guard

  const sb = createAdminClient()
  const { data: conn } = await sb
    .from('ghl_connections')
    .select('refresh_token')
    .eq('location_id', locationId)
    .single()

  if (!conn?.refresh_token) return { error: 'No refresh token on file — reconnect required.' }

  try {
    await refreshGhlToken(locationId, conn.refresh_token)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Refresh failed' }
  }

  revalidatePath('/admin/diagnostics')
}
