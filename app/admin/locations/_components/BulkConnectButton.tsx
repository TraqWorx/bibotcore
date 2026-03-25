'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { connectLocations } from '../_actions'

interface Props {
  designs: { slug: string; name: string }[]
  unconnectedLocations: { id: string; name: string }[]
}

export default function BulkConnectButton({ designs, unconnectedLocations }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [designSlug, setDesignSlug] = useState(designs[0]?.slug ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(unconnectedLocations.map((l) => l.id)))
  }

  async function handleSubmit() {
    if (!selected.size) { setError('Select at least one location'); return }
    if (!designSlug) { setError('Select a design'); return }
    setLoading(true)
    setError(null)
    const result = await connectLocations([...selected], designSlug)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setOpen(false)
      setSelected(new Set())
      router.refresh()
    }
  }

  if (unconnectedLocations.length === 0) return null

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[#2A00CC] px-4 py-2 text-sm font-medium text-white hover:bg-[#1A0099] transition-colors"
      >
        Bulk Connect
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2A00CC]/40">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Bulk Connect</h2>
          <button onClick={() => setOpen(false)} className="text-sm text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Bulk connect provisions users and installs the design. Each location will still need OAuth authorization
          (via the &quot;Authorize&quot; button) before contacts and pipelines work.
        </p>

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

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-500">
              Locations ({selected.size} selected)
            </label>
            <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-800">
              Select all
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
            {unconnectedLocations.map((loc) => (
              <label
                key={loc.id}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(loc.id)}
                  onChange={() => toggle(loc.id)}
                  className="h-4 w-4 rounded border-gray-300 text-black focus:ring-0"
                />
                <span className="text-sm text-gray-800">{loc.name}</span>
                <span className="ml-auto font-mono text-xs text-gray-400">{loc.id}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-lg bg-[#2A00CC] px-4 py-2 text-sm font-medium text-white hover:bg-[#1A0099] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Connecting…' : `Connect${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
