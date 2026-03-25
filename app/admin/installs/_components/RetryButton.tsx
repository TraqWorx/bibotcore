'use client'

import { useState, useTransition } from 'react'
import { retryInstall } from '../_actions'

export default function RetryButton({ locationId }: { locationId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleRetry() {
    setError(null)
    startTransition(async () => {
      const result = await retryInstall(locationId)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRetry}
        disabled={isPending}
        className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? '…' : 'Retry Installer'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
