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
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
      >
        {pending ? 'Refreshing…' : 'Refresh now'}
      </button>
      {msg && (
        <span className={`text-[10px] font-semibold ${msg === 'Refreshed' ? 'text-emerald-700' : 'text-rose-700'}`}>
          {msg}
        </span>
      )}
    </div>
  )
}
