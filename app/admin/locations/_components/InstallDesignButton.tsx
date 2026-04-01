'use client'

import { useState } from 'react'
import { installDesign } from '../_actions'
import { ad } from '@/lib/admin/ui'

interface Props {
  locationId: string
  designs: { slug: string; name: string }[]
}

export default function InstallDesignButton({ locationId, designs }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const designSlug = formData.get('design_slug') as string
    if (!designSlug) return
    setLoading(true)
    setError(null)
    const result = await installDesign(locationId, designSlug)
    setLoading(false)
    if (result?.error) setError(result.error)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
      >
        Install Design
      </button>
    )
  }

  return (
    <form action={handleSubmit} className="flex items-center gap-2">
      <select
        name="design_slug"
        className="rounded-xl border border-gray-200/90 bg-white px-2 py-1 text-xs outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
      >
        {designs.map((d) => (
          <option key={d.slug} value={d.slug}>
            {d.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-brand px-2.5 py-1 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        {loading ? '…' : 'Install'}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  )
}
