'use client'

import { useState, useTransition } from 'react'
import { submitAccessRequest } from '../_actions'

export default function RequestAccessModal() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()

  const submit = () => {
    setErr('')
    start(async () => {
      const r = await submitAccessRequest(email, message)
      if (r.error) setErr(r.error)
      else setDone(true)
    })
  }

  const close = () => { setOpen(false); setDone(false); setErr(''); setEmail(''); setMessage('') }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        style={{ background: 'linear-gradient(90deg,#5B2BFF,#00D6E8)' }}
      >
        Request access
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(3,0,20,0.7)', backdropFilter: 'blur(4px)' }} onClick={close}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#150044', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
            {done ? (
              <div className="text-center text-white">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-2xl" style={{ background: 'rgba(0,214,232,0.15)' }}>✓</div>
                <h3 className="text-lg font-bold">Request received</h3>
                <p className="mt-2 text-sm text-white/60">Thanks — we&apos;ll be in touch shortly.</p>
                <button onClick={close} className="mt-5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: 'linear-gradient(90deg,#5B2BFF,#00D6E8)' }}>Close</button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-white">Request access</h3>
                <p className="mt-1 text-sm text-white/50">GHL Custom Dash is invite-only. Tell us about you and we&apos;ll set you up.</p>
                <input
                  type="email"
                  required
                  placeholder="you@agency.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-4 w-full rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-cyan-400/40"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}
                />
                <textarea
                  placeholder="How many GHL sub-accounts? What do you need?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="mt-3 w-full resize-none rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-cyan-400/40"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}
                />
                {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
                <button
                  onClick={submit}
                  disabled={pending}
                  className="mt-4 w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                  style={{ background: 'linear-gradient(90deg,#5B2BFF,#00D6E8)', boxShadow: '0 8px 28px rgba(91,43,255,0.4)' }}
                >
                  {pending ? 'Sending…' : 'Send request'}
                </button>
                <p className="mt-3 text-center text-xs text-white/35">Or email us at <a href="mailto:info@traqworx.com" className="text-cyan-300 hover:underline">info@traqworx.com</a></p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
