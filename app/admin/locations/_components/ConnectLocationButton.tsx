'use client'

import { useState } from 'react'
import { getConnectLocationUrl } from '../_actions'
import { ad } from '@/lib/admin/ui'

export default function ConnectLocationButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    const result = await getConnectLocationUrl()
    if ('error' in result) {
      setError(result.error)
      setLoading(false)
    } else {
      window.location.href = result.url
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`${ad.btnPrimary} px-5 py-2.5 text-sm disabled:opacity-50`}
      >
        {loading ? 'Connecting...' : 'Connect Location'}
      </button>
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}
