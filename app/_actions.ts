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

  // 1) Notify the team (reply-to the requester so a reply reaches them).
  await sendMail({
    to: process.env.ACCESS_REQUEST_TO || 'info@traqworx.com',
    replyTo: e,
    subject: `New access request — ${e}`,
    text: `New GHL Custom Dash access request\n\nFrom: ${e}\n\nMessage:\n${msg || '(none)'}`,
  }).catch(() => {})

  // 2) Confirmation to the requester (reply-to info@traqworx.com).
  await sendMail({
    to: e,
    replyTo: 'info@traqworx.com',
    subject: 'We received your request — GHL Custom Dash',
    text: `Hi,\n\nThanks for your interest in GHL Custom Dash — we've received your request and will be in touch shortly.\n\nIf you need anything in the meantime, just reply to this email.\n\n— GHL Custom Dash`,
  }).catch(() => {})

  return { ok: true }
}
