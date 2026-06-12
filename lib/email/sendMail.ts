import nodemailer from 'nodemailer'

let cached: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (cached) return cached
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  cached = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
  return cached
}

/**
 * Send a transactional email via the app's SMTP credentials (SMTP_HOST/PORT/
 * USER/PASS/FROM env). Best-effort: returns false (and logs) if SMTP isn't
 * configured or the send fails — callers should not block on it.
 */
export async function sendMail(opts: { to: string; subject: string; text?: string; html?: string; replyTo?: string }): Promise<boolean> {
  const t = getTransporter()
  if (!t) return false
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || ''
  try {
    await t.sendMail({ from, to: opts.to, subject: opts.subject, text: opts.text, html: opts.html, replyTo: opts.replyTo })
    return true
  } catch (err) {
    console.error('[sendMail]', err instanceof Error ? err.message : err)
    return false
  }
}
