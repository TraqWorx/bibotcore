'use client'

import { useState } from 'react'
import { getConnectLocationUrl } from '../_actions'

export default function ConnectLocationButton({ locationId, size = 'default' }: { locationId: string; size?: 'default' | 'small' }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    const result = await getConnectLocationUrl(locationId)
    if ('error' in result) {
      setError(result.error)
      setLoading(false)
    } else {
      window.location.href = result.url
    }
  }

  const cls = size === 'small'
    ? 'inline-flex items-center gap-1 rounded-lg border border-brand/25 bg-brand/5 px-2.5 py-1 text-[11px] font-semibold text-brand shadow-sm transition hover:bg-brand/10 disabled:opacity-50'
    : 'rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50'

  return (
    <div>
      <button onClick={handleClick} disabled={loading} className={cls}>
        {loading ? 'Connecting...' : 'Connect GHL'}
      </button>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}
