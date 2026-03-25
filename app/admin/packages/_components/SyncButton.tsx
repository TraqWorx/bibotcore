'use client'

import { useState } from 'react'

export default function SyncButton({
  syncAction,
  label = 'Sync GHL Apps',
}: {
  syncAction: () => Promise<{ synced: number; error?: string } | undefined>
  label?: string
}) {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<{ synced?: number; error?: string } | null>(null)

  async function handleSync() {
    setSyncing(true)
    setResult(null)
    const res = await syncAction()
    setResult(res ?? { synced: 0 })
    setSyncing(false)
  }

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className={`text-xs ${result.error ? 'text-red-600' : 'text-gray-500'}`}>
          {result.error ? result.error : `Synced ${result.synced} app${result.synced !== 1 ? 's' : ''}`}
        </span>
      )}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-150 ease-out hover:bg-gray-50 disabled:opacity-40"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className={syncing ? 'animate-spin' : ''}
        >
          <path
            d="M13 7A6 6 0 1 1 7 1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M7 1l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {syncing ? 'Syncing…' : label}
      </button>
    </div>
  )
}
