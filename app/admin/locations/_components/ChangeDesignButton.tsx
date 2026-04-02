'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { installDesign } from '../_actions'

interface Props {
  locationId: string
  currentSlug: string | null
  designs: { slug: string; name: string }[]
  children?: React.ReactNode
}

export default function ChangeDesignButton({ locationId, currentSlug, designs, children }: Props) {
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
        className={children
          ? 'group inline-flex items-center gap-1 rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand shadow-sm transition-colors whitespace-nowrap hover:bg-brand/15 hover:border-brand/35 cursor-pointer'
          : 'rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap'}
        title={children ? 'Click to change design' : undefined}
      >
        <span className={children ? 'underline-offset-2 group-hover:underline' : ''}>
          {children ?? 'Change design'}
        </span>
        {children && (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-brand/70 transition group-hover:text-brand">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        )}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded-xl border border-gray-200/90 bg-white px-2 py-1 text-xs outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
      >
        {designs.map((d) => (
          <option key={d.slug} value={d.slug}>{d.name}</option>
        ))}
      </select>
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="rounded-xl bg-brand px-2.5 py-1 text-xs font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
      >
        {loading ? '…' : 'Save'}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="rounded-xl border border-gray-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
