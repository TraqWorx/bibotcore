'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveContactFilters } from '../_actions'

interface Props {
  locationId: string
  ghlTags: string[]
  selectedFilters: string[]
}

export default function ContactFiltersForm({ locationId, ghlTags, selectedFilters }: Props) {
  const router = useRouter()
  const [filters, setFilters] = useState<Set<string>>(new Set(selectedFilters))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [customTag, setCustomTag] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Merge discovered GHL tags + any previously saved filters not in ghlTags
  const allTags = [...new Set([...ghlTags, ...selectedFilters])].sort()

  // Suggestions: GHL tags matching input that aren't already selected
  const suggestions = customTag.trim()
    ? ghlTags.filter(
        (t) => t.toLowerCase().includes(customTag.toLowerCase()) && !filters.has(t)
      )
    : []

  function toggle(tag: string) {
    setFilters((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
    setSuccess(false)
  }

  function addCustomTag() {
    const tag = customTag.trim().toLowerCase()
    if (!tag) return
    setFilters((prev) => new Set(prev).add(tag))
    setCustomTag('')
    setSuccess(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(false)
    const result = await saveContactFilters(locationId, [...filters])
    setSaving(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">
        Seleziona i tag che vuoi mostrare come filtri nella pagina Contatti.
      </p>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => {
            const isSelected = filters.has(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors capitalize"
                style={isSelected
                  ? { background: '#2A00CC', color: 'white', borderColor: '#2A00CC' }
                  : { background: 'white', color: '#374151', borderColor: '#e5e7eb' }
                }
              >
                {tag}
              </button>
            )
          })}
        </div>
      )}

      {/* Tag input with autocomplete */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            value={customTag}
            onChange={(e) => { setCustomTag(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (suggestions.length === 1) {
                  toggle(suggestions[0])
                  setCustomTag('')
                } else {
                  addCustomTag()
                }
                setShowSuggestions(false)
              }
              if (e.key === 'Escape') setShowSuggestions(false)
            }}
            placeholder="Cerca o aggiungi tag..."
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)] transition-colors"
          />
          <button
            type="button"
            onClick={() => { addCustomTag(); setShowSuggestions(false) }}
            disabled={!customTag.trim()}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            Aggiungi
          </button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-16 z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  toggle(tag)
                  setCustomTag('')
                  setShowSuggestions(false)
                }}
                className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 capitalize transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      {success && <p className="text-sm font-medium text-emerald-600">Salvato!</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl py-2.5 text-sm font-bold text-black transition-colors hover:opacity-90 disabled:opacity-50"
        style={{ background: '#00F0FF' }}
      >
        {saving ? 'Salvataggio...' : 'Salva Filtri'}
      </button>
    </div>
  )
}
