'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { installDesign } from '../_actions'

interface Props {
  locationId: string
  currentSlug: string | null
  designs: { slug: string; name: string }[]
}

export default function ChangeDesignButton({ locationId, currentSlug, designs }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(currentSlug ?? designs[0]?.slug ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!selected || selected === currentSlug) { setOpen(false); return }
    setLoading(true)
    setError(null)
    const result = await installDesign(locationId, selected)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setOpen(false)
      router.refresh()
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-100 transition-colors whitespace-nowrap"
      >
        Design
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-gray-300"
      >
        {designs.map((d) => (
          <option key={d.slug} value={d.slug}>{d.name}</option>
        ))}
      </select>
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
      >
        {loading ? '…' : 'Save'}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
