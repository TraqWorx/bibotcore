'use client'

import { useState } from 'react'
import { getGhlOAuthUrl } from '../_actions'

interface Props {
  designs: { slug: string; name: string }[]
  // kept for API compat but not used — GHL chooselocation handles location selection
  unconnectedLocations?: { id: string; name: string }[]
  preselectedId?: string
}

export default function ConnectButton({ designs }: Props) {
  const [open, setOpen] = useState(false)
  const [designSlug, setDesignSlug] = useState(designs[0]?.slug ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    if (!designSlug) { setError('Select a design'); return }
    setLoading(true)
    setError(null)
    const result = await getGhlOAuthUrl(designSlug)
    setLoading(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      window.location.href = result.url
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-[#2A00CC]/20 bg-[#2A00CC]/5 px-3 py-1 text-xs font-medium text-[#2A00CC] hover:bg-[#2A00CC]/10 transition-colors"
      >
        Connect
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2A00CC]/40">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Connect via GHL</h2>
          <button onClick={() => setOpen(false)} className="text-sm text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Design</label>
          <select
            value={designSlug}
            onChange={(e) => setDesignSlug(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
          >
            {designs.map((d) => (
              <option key={d.slug} value={d.slug}>{d.name}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-gray-400">
          You'll be redirected to GHL to authorize the app on a sub-account.
        </p>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={loading}
            className="rounded-lg bg-[#2A00CC] px-4 py-2 text-sm font-medium text-white hover:bg-[#1A0099] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Redirecting…' : 'Connect via GHL'}
          </button>
        </div>
      </div>
    </div>
  )
}
