'use server'

import { createAdminClient } from '@/lib/supabase-server'
import { sendMail } from '@/lib/email/sendMail'

/** Public landing "Request access" form → stored in access_requests + emails info@traqworx.com (if SMTP configured). */
export async function submitAccessRequest(email: string, message: string): Promise<{ error?: string; ok?: boolean }> {
  const e = (email || '').trim().toLowerCase()
  if (!e || !e.includes('@') || e.length > 200) return { error: 'Please enter a valid email.' }
  const msg = (message || '').trim().slice(0, 2000)
  const sb = createAdminClient()
  const { error } = await sb.from('access_requests').insert({ email: e, message: msg || null })
  if (error) return { error: 'Could not submit — please email info@traqworx.com.' }

  // Notify (best-effort — never blocks/fails the request if SMTP isn't set).
  await sendMail({
    to: process.env.ACCESS_REQUEST_TO || 'info@traqworx.com',
    replyTo: e,
    subject: `New access request — ${e}`,
    text: `New GHL Custom Dash access request\n\nFrom: ${e}\n\nMessage:\n${msg || '(none)'}`,
  }).catch(() => {})

  return { ok: true }
}
