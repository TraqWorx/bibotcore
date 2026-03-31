'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function PortalLoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // Get locationId from URL params
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const locationId = searchParams?.get('locationId') ?? ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // First verify that this email belongs to a contact in this location
      const verifyRes = await fetch('/api/portal/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), locationId }),
      })

      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        setError(data.error ?? 'Email non trovata')
        setLoading(false)
        return
      }

      // Send magic link
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback?redirectTo=/portal/${locationId}`,
        },
      })

      if (authError) {
        setError(authError.message)
      } else {
        setSent(true)
      }
    } catch {
      setError('Errore di connessione')
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
            <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Controlla la tua email</h2>
          <p className="mt-2 text-sm text-gray-500">
            Abbiamo inviato un link di accesso a <strong>{email}</strong>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2A00CC] to-[#6366f1]">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Area Clienti</h1>
          <p className="mt-1 text-sm text-gray-500">Accedi con la tua email</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="la-tua@email.com"
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#2A00CC] focus:outline-none focus:ring-1 focus:ring-[#2A00CC]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[#2A00CC] to-[#6366f1] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
          >
            {loading ? 'Invio in corso...' : 'Invia link di accesso'}
          </button>
        </form>
      </div>
    </div>
  )
}
