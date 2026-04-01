'use client'

import { useState, useTransition } from 'react'
import { saveCategoryTags, createLocationTag } from '../_actions'
import { type CategoryDef } from '@/lib/utils/categoryFields'
import { sf } from '@/lib/simfonia/ui'

const accentFill = {
  background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 88%, white) 100%)',
} as const

interface TagInfo {
  id: string
  name: string
}

interface Props {
  locationId: string
  categories: CategoryDef[]
  allTags: TagInfo[]
  initialCategoryTags: Record<string, string[]>
}

export default function CategoryTagsForm({ locationId, categories, allTags: initialAllTags, initialCategoryTags }: Props) {
  const [categoryTags, setCategoryTags] = useState<Record<string, string[]>>(initialCategoryTags)
  const [allTags, setAllTags] = useState<TagInfo[]>(initialAllTags)
  const [newTagInputs, setNewTagInputs] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  function toggleTag(categoryLabel: string, tagName: string) {
    setCategoryTags((prev) => {
      const current = prev[categoryLabel] ?? []
      const next = current.includes(tagName)
        ? current.filter((t) => t !== tagName)
        : [...current, tagName]
      return { ...prev, [categoryLabel]: next }
    })
  }

  function removeTagFromCategory(categoryLabel: string, tagName: string) {
    const updated = { ...categoryTags }
    updated[categoryLabel] = (updated[categoryLabel] ?? []).filter((t) => t !== tagName)
    setCategoryTags(updated)
    // Auto-save after removal
    startTransition(async () => {
      const result = await saveCategoryTags(locationId, updated)
      if (result.error) {
        setMessage({ text: result.error, error: true })
      }
    })
  }

  function handleCreateTag(categoryLabel: string) {
    const name = (newTagInputs[categoryLabel] ?? '').trim()
    if (!name) return
    startTransition(async () => {
      setMessage(null)
      const result = await createLocationTag(locationId, name)
      if (result.error) {
        // Tag might already exist — still associate it
        if (result.error.includes('esiste')) {
          setCategoryTags((prev) => {
            const current = prev[categoryLabel] ?? []
            if (current.includes(name)) return prev
            return { ...prev, [categoryLabel]: [...current, name] }
          })
          setNewTagInputs((prev) => ({ ...prev, [categoryLabel]: '' }))
        } else {
          setMessage({ text: result.error, error: true })
        }
        return
      }
      // Add to local tags list and associate to this category
      setAllTags((prev) => {
        if (prev.some((t) => t.name === name)) return prev
        return [...prev, { id: `new-${Date.now()}`, name }].sort((a, b) => a.name.localeCompare(b.name))
      })
      setCategoryTags((prev) => {
        const current = prev[categoryLabel] ?? []
        if (current.includes(name)) return prev
        return { ...prev, [categoryLabel]: [...current, name] }
      })
      setNewTagInputs((prev) => ({ ...prev, [categoryLabel]: '' }))
      // Auto-save associations
      const updated = { ...categoryTags }
      updated[categoryLabel] = [...(updated[categoryLabel] ?? []), name]
      await saveCategoryTags(locationId, updated)
    })
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveCategoryTags(locationId, categoryTags)
      if (result.error) {
        setMessage({ text: result.error, error: true })
      } else {
        setMessage({ text: 'Salvato con successo', error: false })
        setTimeout(() => setMessage(null), 3000)
      }
    })
  }

  return (
    <div className="space-y-6">
      {categories.map((cat) => {
        const selected = categoryTags[cat.label] ?? []
        const unselected = allTags.filter((t) => !selected.includes(t.name))
        return (
          <div key={cat.slug} className="rounded-2xl border border-gray-200/60 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
            <p className="mb-3 text-sm font-bold text-gray-900">{cat.label}</p>

            {/* Selected tags for this category */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {selected.map((tagName) => (
                  <span
                    key={tagName}
                    className="inline-flex items-center gap-1 rounded-full border border-brand/35 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand"
                  >
                    {tagName}
                    <button
                      type="button"
                      onClick={() => removeTagFromCategory(cat.label, tagName)}
                      className="ml-0.5 text-current opacity-50 hover:opacity-100"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add existing tag */}
            {unselected.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {unselected.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(cat.label, tag.name)}
                    className="rounded-full border border-gray-200/90 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-brand/25 hover:bg-brand/5"
                  >
                    + {tag.name}
                  </button>
                ))}
              </div>
            )}

            {/* Create new tag for this category */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagInputs[cat.label] ?? ''}
                onChange={(e) => setNewTagInputs((prev) => ({ ...prev, [cat.label]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreateTag(cat.label)
                  }
                }}
                placeholder="Crea nuovo tag..."
                className={`${sf.inputSm} flex-1 text-xs`}
              />
              <button
                type="button"
                onClick={() => handleCreateTag(cat.label)}
                disabled={isPending}
                className={`${sf.btnBrand} shrink-0 px-3 py-1.5 text-xs`}
              >
                + Crea
              </button>
            </div>
          </div>
        )
      })}

      {message && (
        <p className={`text-sm font-medium ${message.error ? 'text-red-600' : 'text-green-600'}`}>
          {message.text}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className={`${sf.btnSave} font-bold`}
        style={accentFill}
      >
        {isPending ? 'Salvataggio…' : 'Salva associazioni tag'}
      </button>
    </div>
  )
}
