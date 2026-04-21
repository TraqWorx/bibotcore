'use client'

import { useState } from 'react'
import { getGhlOAuthUrl } from '../_actions'
import { ad } from '@/lib/admin/ui'

interface Props {
  designs: { slug: string; name: string }[]
  // kept for API compat but not used — GHL chooselocation handles location selection
  unconnectedLocations?: { id: string; name: string }[]
  preselectedId?: string
}

export default function ConnectButton({ designs }: Props) {
  const [open, setOpen] = useState(false)
  const [designSlug, setDesignSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    // designSlug can be empty — connecting without a design is allowed
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
        className="rounded-xl border border-brand/25 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/10"
      >
        Connect
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm space-y-4 rounded-3xl border border-gray-200/70 bg-white/95 p-6 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Connect via GHL</h2>
          <button onClick={() => setOpen(false)} className="text-sm text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Design</label>
          <select
            value={designSlug}
            onChange={(e) => setDesignSlug(e.target.value)}
            className={ad.input}
          >
            <option value="">— No design —</option>
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
            className={ad.btnSecondary}
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={loading}
            className={ad.btnPrimary}
          >
            {loading ? 'Redirecting…' : 'Connect via GHL'}
          </button>
        </div>
      </div>
    </div>
  )
}
