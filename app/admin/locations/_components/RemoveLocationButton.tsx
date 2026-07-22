'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { removeLocation } from '../_actions'

export default function RemoveLocationButton({ locationId, name }: { locationId: string; name: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRemove() {
    if (!confirm(`Remove "${name}" from your dashboard? This only deletes it here — nothing in GHL is touched.`)) return
    setLoading(true)
    setError(null)
    const res = await removeLocation(locationId)
    if (res?.error) {
      setError(res.error)
      setLoading(false)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <button
        onClick={handleRemove}
        disabled={loading}
        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        {loading ? 'Removing…' : 'Remove'}
      </button>
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
    </div>
  )
}
