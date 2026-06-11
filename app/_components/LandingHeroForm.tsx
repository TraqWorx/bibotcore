'use client'

import { useState } from 'react'
import { requestMagicLink } from '../login/_actions'

export default function LandingHeroForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!email) {
      setIsError(true)
      setMessage('Enter your email to log in')
      return
    }
    setLoading(true)
    setMessage('')
    const result = await requestMagicLink(email)
    setLoading(false)
    if (result?.error) {
      setIsError(true)
      setMessage(result.error)
    } else {
      setIsError(false)
      setMessage('Check your inbox — we sent you a magic link to sign in.')
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          placeholder="you@agency.com"
          className="h-12 flex-1 rounded-xl px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:ring-2 focus:ring-cyan-400/40"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button
          onClick={submit}
          disabled={loading}
          className="h-12 shrink-0 rounded-xl px-6 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ background: 'linear-gradient(90deg,#5B2BFF,#00D6E8)', boxShadow: '0 8px 28px rgba(91,43,255,0.45)' }}
        >
          {loading ? 'Sending…' : 'Log in'}
        </button>
      </div>
      {message && (
        <p className="mt-3 text-sm" style={{ color: isError ? '#fca5a5' : '#6ee7b7' }}>
          {message}
        </p>
      )}
      <p className="mt-3 text-xs text-white/35">Invite-only · we&apos;ll email you a secure login link. Need access? <a href="mailto:info@espressotranslations.com" className="text-cyan-300 hover:underline">Contact us</a>.</p>
    </div>
  )
}
