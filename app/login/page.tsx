'use client'

import Image from 'next/image'
import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { checkLoginAllowed } from './_actions'

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
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(() => getInitialUrlError())
  const [next, setNext] = useState('/redirect')
  const emailRef = useRef<HTMLInputElement>(null)

  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ),
  )

  // Parse ?next=, and any error from the Supabase redirect hash / query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nx = params.get('next')
    if (nx && nx.startsWith('/') && !nx.startsWith('//')) setNext(nx)
    const msg = params.get('message')
    if (msg) {
      setUrlError(msg)
      history.replaceState(null, '', window.location.pathname + (nx ? `?next=${encodeURIComponent(nx)}` : ''))
    }
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  const callbackUrl = () =>
    `${window.location.origin}/api/auth/callback?redirectTo=${encodeURIComponent(next)}`

  // Step 1 — send the email (magic link + 6-digit code)
  const sendCode = async () => {
    // Read the field directly too, so mobile autofill (which can skip React's
    // onChange) never produces a false "enter your email".
    const em = (email || emailRef.current?.value || '').trim().toLowerCase()
    if (!em) {
      setIsError(true)
      setMessage('Please enter your email')
      return
    }
    setEmail(em)
    setLoading(true)
    setMessage('')
    setUrlError(null)

    const check = await checkLoginAllowed(em)
    if ('error' in check) {
      setLoading(false)
      setIsError(true)
      setMessage(check.error)
      return
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: em,
      options: { emailRedirectTo: callbackUrl() },
    })
    setLoading(false)
    if (error) {
      setIsError(true)
      setMessage(error.message)
      return
    }
    setIsError(false)
    setMessage('')
    setCode('')
    setStep('code')
  }

  // Step 2 — verify the 6-digit code (works on any device; scanners can't consume it)
  const verifyCode = async () => {
    const c = code.replace(/\D/g, '')
    if (c.length < 6) {
      setIsError(true)
      setMessage('Enter the code from the email')
      return
    }
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.verifyOtp({ email, token: c, type: 'email' })
    setLoading(false)
    if (error) {
      setIsError(true)
      setMessage('Invalid or expired code. Use the latest email, or resend below.')
      return
    }
    window.location.href = next
  }

  const resend = async () => {
    setCode('')
    await sendCode()
    if (!isError) setMessage('New code sent — check your email.')
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
              src="/ghlcustomdash-mark.svg"
              alt="GHL Custom Dash"
              width={64}
              height={64}
              className="h-16 w-16 rounded-2xl"
              style={{ boxShadow: '0 0 32px rgba(91,43,255,0.5)' }}
            />
            <div className="text-center">
              <h1 className="text-lg font-bold text-white">GHL Custom Dash</h1>
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

          {step === 'email' ? (
            /* Step 1 — email */
            <div className="space-y-3">
              <input
                ref={emailRef}
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder="Enter your email"
                className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:ring-2"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendCode()}
              />
              <button
                onClick={sendCode}
                disabled={loading}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: '#2A00CC', boxShadow: '0 4px 20px rgba(42,0,204,0.4)' }}
              >
                {loading ? 'Sending…' : 'Send login code'}
              </button>
            </div>
          ) : (
            /* Step 2 — code */
            <div className="space-y-3">
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                We emailed a login code (and a link) to <strong className="text-white">{email}</strong>.
                Enter the code below, or just tap the link in the email.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                placeholder="Login code"
                className="w-full rounded-xl px-4 py-3 text-center text-lg tracking-[0.3em] text-white outline-none transition placeholder:text-white/20 focus:ring-2"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
                autoFocus
              />
              <button
                onClick={verifyCode}
                disabled={loading || code.length < 6}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: '#2A00CC', boxShadow: '0 4px 20px rgba(42,0,204,0.4)' }}
              >
                {loading ? 'Verifying…' : 'Verify & sign in'}
              </button>
              <div className="flex items-center justify-between text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <button onClick={() => { setStep('email'); setMessage(''); setIsError(false) }} className="underline">
                  Change email
                </button>
                <button onClick={resend} disabled={loading} className="underline disabled:opacity-50">
                  Resend code
                </button>
              </div>
            </div>
          )}

          {/* Feedback */}
          {message && (
            <p className="text-center text-sm" style={{ color: isError ? '#fca5a5' : '#6ee7b7' }}>
              {message}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          © {new Date().getFullYear()} GHL Custom Dash
        </p>
      </div>
    </div>
  )
}
