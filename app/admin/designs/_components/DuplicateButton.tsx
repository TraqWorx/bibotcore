'use client'

import { useState } from 'react'
import { duplicateDesign } from '../_actions'

export default function DuplicateButton({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    const newSlug = window.prompt(`Enter a new slug for the duplicate of "${slug}":`)
    if (!newSlug) return

    setLoading(true)
    const result = await duplicateDesign(slug, newSlug)
    setLoading(false)

    if (result?.error) {
      alert(`Error: ${result.error}`)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs font-medium text-gray-400 transition-colors hover:text-gray-900 disabled:opacity-50"
    >
      {loading ? 'Duplicating…' : 'Duplicate'}
    </button>
  )
}
