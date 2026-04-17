'use client'

import { useState } from 'react'
import { addLocation } from '../_actions'
import { ad } from '@/lib/admin/ui'

export default function AddLocationForm() {
  const [locationId, setLocationId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!locationId.trim()) return
    setLoading(true)
    setError(null)
    const result = await addLocation(locationId)
    if (result?.error) {
      setError(result.error)
    } else {
      setLocationId('')
      setOpen(false)
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={`${ad.btnPrimary} px-4 py-2 text-sm`}>
        Add Location
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={locationId}
        onChange={(e) => setLocationId(e.target.value)}
        placeholder="Enter GHL Location ID"
        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 w-64"
        autoFocus
      />
      <button type="submit" disabled={loading || !locationId.trim()} className={`${ad.btnPrimary} px-4 py-2 text-sm disabled:opacity-50`}>
        {loading ? 'Adding...' : 'Add'}
      </button>
      <button type="button" onClick={() => { setOpen(false); setError(null) }} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">
        Cancel
      </button>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </form>
  )
}
