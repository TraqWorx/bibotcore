'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { disconnectLocation } from '../_actions'

export default function DisconnectButton({ locationId }: { locationId: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDisconnect() {
    setLoading(true)
    await disconnectLocation(locationId)
    setLoading(false)
    setConfirm(false)
    router.refresh()
  }

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors whitespace-nowrap"
      >
        Disconnect
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">Sure?</span>
      <button
        onClick={handleDisconnect}
        disabled={loading}
        className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
      >
        {loading ? '…' : 'Yes'}
      </button>
      <button
        onClick={() => setConfirm(false)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        No
      </button>
    </div>
  )
}
