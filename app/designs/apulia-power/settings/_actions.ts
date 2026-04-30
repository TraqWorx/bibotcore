'use server'

import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { fullSyncCache } from '@/lib/apulia/cache'

async function ensureOwner(): Promise<{ email: string } | { error: string }> {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  if (profile?.role === 'super_admin') return { email: user.email ?? '' }
  if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) return { error: 'Forbidden' }
  if (profile.role !== 'admin') return { error: 'Forbidden' }
  return { email: user.email ?? '' }
}

export async function setPayoutSchedule(h1: string, h2: string): Promise<{ error: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard
  if (!/^\d{2}-\d{2}$/.test(h1) || !/^\d{2}-\d{2}$/.test(h2)) {
    return { error: 'Formato data deve essere MM-DD' }
  }
  const sb = createAdminClient()
  const { error } = await sb.from('apulia_settings').upsert(
    { key: 'payout_schedule', value: { H1: h1, H2: h2 }, updated_at: new Date().toISOString(), updated_by: guard.email },
    { onConflict: 'key' },
  )
  if (error) return { error: error.message }
  revalidatePath('/designs/apulia-power/settings')
  revalidatePath('/designs/apulia-power/dashboard')
}

export async function resyncCache(): Promise<{ total: number; deleted: number; error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return { total: 0, deleted: 0, error: guard.error }
  try {
    const r = await fullSyncCache()
    revalidatePath('/designs/apulia-power/dashboard', 'layout')
    return r
  } catch (err) {
    return { total: 0, deleted: 0, error: err instanceof Error ? err.message : 'failed' }
  }
}
