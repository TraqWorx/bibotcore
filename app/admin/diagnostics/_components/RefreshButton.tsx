'use client'

import { useState, useTransition } from 'react'
import { refreshConnection } from '../_actions'

export default function RefreshButton({ locationId }: { locationId: string }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function onClick() {
    setMsg(null)
    startTransition(async () => {
      const res = await refreshConnection(locationId)
      if (res?.error) setMsg(res.error)
      else setMsg('Refreshed')
    })
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-[10px] font-bold uppercase tracking-wide text-gray-500 hover:text-gray-900 disabled:opacity-50"
      >
        {pending ? 'Refreshing…' : 'Refresh'}
      </button>
      {msg && (
        <span className={`text-[10px] font-semibold ${msg === 'Refreshed' ? 'text-emerald-600' : 'text-rose-600'}`}>
          · {msg}
        </span>
      )}
    </span>
  )
}
