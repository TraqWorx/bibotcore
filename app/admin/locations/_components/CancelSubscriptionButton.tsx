'use client'

import { useState } from 'react'

export default function CancelSubscriptionButton({ locationId }: { locationId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canceled, setCanceled] = useState(false)

  async function handleCancel() {
    if (!confirm('Cancel subscription for this location? The dashboard link will stop working.')) return
    setLoading(true)
    setError(null)
    const res = await fetch('/api/stripe/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId }),
    })
    if (res.ok) {
      setCanceled(true)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to cancel')
    }
    setLoading(false)
  }

  if (canceled) {
    return <span className="text-xs font-medium text-gray-400">Canceled</span>
  }

  return (
    <div>
      <button
        onClick={handleCancel}
        disabled={loading}
        className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
      >
        {loading ? 'Canceling...' : 'Cancel'}
      </button>
      {error && <p className="mt-1 text-[10px] text-red-500">{error}</p>}
    </div>
  )
}
