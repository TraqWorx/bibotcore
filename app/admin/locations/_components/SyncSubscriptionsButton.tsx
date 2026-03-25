'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { syncLocationSubscriptions } from '../_actions'

export default function SyncSubscriptionsButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setResult(null)
    const res = await syncLocationSubscriptions()
    setLoading(false)
    if (res.error) {
      setResult(`Error: ${res.error}`)
    } else {
      setResult(`${res.synced} location${res.synced !== 1 ? 's' : ''} assigned`)
      router.refresh()
      setTimeout(() => setResult(null), 3000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className={`text-xs ${result.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {result}
        </span>
      )}
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? 'Syncing…' : 'Sync Plan Prices'}
      </button>
    </div>
  )
}
