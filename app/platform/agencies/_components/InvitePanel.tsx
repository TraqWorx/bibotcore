'use client'

import { useState, useTransition } from 'react'
import { inviteAdmin } from '../_actions'

export default function InvitePanel() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState(false)
  const [pending, start] = useTransition()

  const submit = () => {
    if (!email.trim()) { setErr(true); setMsg('Enter an email'); return }
    start(async () => {
      setMsg('')
      const r = await inviteAdmin(email)
      if (r.error) { setErr(true); setMsg(r.error) }
      else { setErr(false); setMsg(`Invite sent to ${email.trim().toLowerCase()}`); setEmail('') }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="new-admin@agency.com"
          className="h-9 w-64 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-brand"
        />
        <button
          onClick={submit}
          disabled={pending}
          className="h-9 shrink-0 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Inviting…' : 'Invite admin'}
        </button>
      </div>
      {msg && <p className={`text-xs ${err ? 'text-red-600' : 'text-emerald-600'}`}>{msg}</p>}
    </div>
  )
}
