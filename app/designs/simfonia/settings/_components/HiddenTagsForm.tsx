'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveHiddenTags } from '../_actions'
import { sf } from '@/lib/simfonia/ui'

const accentFill = {
  background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 88%, white) 100%)',
} as const

interface Props {
  locationId: string
  ghlTags: string[]
  hiddenTags: string[]
}

export default function HiddenTagsForm({ locationId, ghlTags, hiddenTags: initialHidden }: Props) {
  const router = useRouter()
  const [hidden, setHidden] = useState<Set<string>>(new Set(initialHidden))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [search, setSearch] = useState('')

  // All known tags (GHL + previously hidden that may no longer be in Bibot)
  const allTags = [...new Set([...ghlTags, ...initialHidden])].sort()

  const filteredTags = search.trim()
    ? allTags.filter((t) => t.toLowerCase().includes(search.toLowerCase()))
    : allTags

  function toggle(tag: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
    setSuccess(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(false)
    const result = await saveHiddenTags(locationId, [...hidden])
    setSaving(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      router.refresh()
    }
  }

  const hiddenList = allTags.filter((t) => hidden.has(t))

  return (
    <div className="space-y-5">
      {/* Currently hidden */}
      {hiddenList.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Tag nascosti ({hiddenList.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {hiddenList.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 capitalize"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => toggle(tag)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cerca tag..."
        className={sf.inputFull}
      />

      {/* All tags */}
      {filteredTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {filteredTags.map((tag) => {
            const isHidden = hidden.has(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors capitalize"
                style={
                  isHidden
                    ? { background: '#dc2626', color: 'white', borderColor: '#dc2626' }
                    : { background: 'white', color: '#374151', borderColor: '#e5e7eb' }
                }
              >
                {isHidden ? `✕ ${tag}` : tag}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-400">Nessun tag trovato.</p>
      )}

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      {success && <p className="text-sm font-medium text-emerald-600">Salvato!</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className={`${sf.btnSave} font-bold`}
        style={accentFill}
      >
        {saving ? 'Salvataggio…' : 'Salva tag nascosti'}
      </button>
    </div>
  )
}
