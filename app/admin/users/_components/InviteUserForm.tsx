'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inviteUser } from '../_actions'
import { ad } from '@/lib/admin/ui'

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
        className={ad.btnPrimary}
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
        className={`${ad.input} w-64 py-2`}
      />
      <button
        type="submit"
        disabled={loading}
        className={ad.btnPrimary}
      >
        {loading ? 'Sending…' : success ? 'Sent ✓' : 'Send Invite'}
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setError(null) }}
        className="text-sm font-medium text-gray-400 hover:text-gray-700"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  )
}
