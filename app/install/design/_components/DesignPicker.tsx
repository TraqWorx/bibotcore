'use client'

import { useState } from 'react'
import { selectDesign } from '../_actions'

interface Design {
  id: string
  slug: string
  name: string
  is_default: boolean
}

export default function DesignPicker({
  installId,
  designs,
}: {
  installId: string
  designs: Design[]
}) {
  const [selected, setSelected] = useState<string>(
    designs.find((d) => d.is_default)?.slug ?? designs[0]?.slug ?? ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    if (!selected) return
    setSaving(true)
    setError('')
    const result = await selectDesign(installId, selected)
    if (result?.error) {
      setError(result.error)
      setSaving(false)
    }
    // on success: server action redirects to /crm/dashboard
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {designs.map((design) => (
          <button
            key={design.slug}
            type="button"
            onClick={() => setSelected(design.slug)}
            className={`rounded-xl border-2 bg-white p-6 text-left transition-all duration-150 ease-out hover:bg-gray-50 ${
              selected === design.slug
                ? 'border-black'
                : 'border-gray-200'
            }`}
          >
            {/* Placeholder preview */}
            <div className="mb-4 h-24 rounded-lg bg-gray-100" />
            <p className="font-medium text-gray-900">{design.name}</p>
            {design.is_default && (
              <p className="mt-0.5 text-xs text-gray-400">Default</p>
            )}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleConfirm}
        disabled={saving || !selected}
        className="rounded-lg bg-black px-6 py-2.5 text-sm font-medium text-white transition-all duration-150 ease-out hover:bg-gray-900 disabled:opacity-40"
      >
        {saving ? 'Applying…' : 'Apply Design'}
      </button>
    </div>
  )
}
