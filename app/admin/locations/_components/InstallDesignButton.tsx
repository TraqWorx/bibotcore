'use client'

import { useState } from 'react'
import { installDesign } from '../_actions'

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
        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-gray-300"
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
        className="rounded-lg bg-[#2A00CC] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1A0099] disabled:opacity-50 transition-colors"
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
