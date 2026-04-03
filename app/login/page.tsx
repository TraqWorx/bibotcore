'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { requestMagicLink } from './_actions'

function getInitialUrlError() {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  if (!hash) return null
  const params = new URLSearchParams(hash.slice(1))
  const code = params.get('error_code')
  const desc = params.get('error_description')?.replace(/\+/g, ' ')
  if (code === 'otp_expired' || code === 'access_denied') {
    return desc ?? 'Your login link has expired. Request a new one below.'
  }
  return desc ?? null
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(() => getInitialUrlError())

  // Parse error from Supabase redirect hash (e.g. expired magic link)
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    // Clean the hash from URL without reload
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  const handleLogin = async () => {
    if (!email) {
      setIsError(true)
      setMessage('Please enter your email')
      return
    }
    setLoading(true)
    setMessage('')
    setUrlError(null)
    const result = await requestMagicLink(email)
    setLoading(false)
    if (result.error) {
      setIsError(true)
      setMessage(result.error)
    } else {
      setIsError(false)
      setMessage('Check your email for the login link')
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0d0030 0%, #1a0066 60%, #0d0030 100%)' }}
    >
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(0,240,255,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-sm px-4">
        {/* Card */}
        <div
          className="rounded-2xl p-8 space-y-6"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <Image
              src="/bibot-logo.svg"
              alt="Bibot Core"
              width={64}
              height={64}
              className="h-16 w-16 rounded-2xl"
              style={{ boxShadow: '0 0 32px rgba(42,0,204,0.5)' }}
            />
            <div className="text-center">
              <h1 className="text-lg font-bold text-white">Bibot Core</h1>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Sign in to your account
              </p>
            </div>
          </div>

          {/* Expired link banner */}
          {urlError && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.2)', color: '#fca5a5' }}
            >
              {urlError}
            </div>
          )}

          {/* Form */}
          <div className="space-y-3">
            <input
              type="email"
              required
              placeholder="Enter your email"
              className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:ring-2"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{
                background: '#2A00CC',
                boxShadow: '0 4px 20px rgba(42,0,204,0.4)',
              }}
            >
              {loading ? 'Checking…' : 'Send Magic Link'}
            </button>
          </div>

          {/* Feedback */}
          {message && (
            <p
              className="text-center text-sm"
              style={{ color: isError ? '#fca5a5' : '#6ee7b7' }}
            >
              {message}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          © {new Date().getFullYear()} Bibot Core
        </p>
      </div>
    </div>
  )
}
