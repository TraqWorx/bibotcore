'use server'

import { createAdminClient } from '@/lib/supabase-server'

/** Public landing "Request access" form → stored in access_requests (super_admin reviews in /platform/requests). */
export async function submitAccessRequest(email: string, message: string): Promise<{ error?: string; ok?: boolean }> {
  const e = (email || '').trim().toLowerCase()
  if (!e || !e.includes('@') || e.length > 200) return { error: 'Please enter a valid email.' }
  const sb = createAdminClient()
  const { error } = await sb.from('access_requests').insert({ email: e, message: (message || '').trim().slice(0, 2000) || null })
  if (error) return { error: 'Could not submit — please email info@traqworx.com.' }
  return { ok: true }
}
