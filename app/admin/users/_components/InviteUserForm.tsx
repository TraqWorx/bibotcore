'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inviteUser } from '../_actions'

export default function InviteUserForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    const result = await inviteUser(email.trim())
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setEmail('')
      router.refresh()
      setTimeout(() => { setOpen(false); setSuccess(false) }, 2000)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[#2A00CC] px-4 py-2 text-sm font-medium text-white hover:bg-[#1A0099] transition-colors"
      >
        Invite User
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="user@example.com"
        required
        autoFocus
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300 w-56"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-[#2A00CC] px-4 py-2 text-sm font-medium text-white hover:bg-[#1A0099] disabled:opacity-50 transition-colors"
      >
        {loading ? 'Sending…' : success ? 'Sent ✓' : 'Send Invite'}
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setError(null) }}
        className="text-sm text-gray-400 hover:text-gray-600"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  )
}
