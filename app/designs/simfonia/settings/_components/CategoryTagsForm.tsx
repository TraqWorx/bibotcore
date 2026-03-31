'use client'

import { useState, useTransition } from 'react'
import { saveCategoryTags, createLocationTag, deleteLocationTag } from '../_actions'
import { type CategoryDef } from '@/lib/utils/categoryFields'

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
          <div key={cat.slug} className="rounded-xl border border-gray-100 bg-white p-4">
            <p className="mb-3 text-sm font-bold text-gray-700">{cat.label}</p>

            {/* Selected tags for this category */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {selected.map((tagName) => (
                  <span
                    key={tagName}
                    className="inline-flex items-center gap-1 rounded-full border border-[#2A00CC] bg-[rgba(42,0,204,0.08)] px-2.5 py-1 text-xs font-medium text-[#2A00CC]"
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
                    className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
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
                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-[#2A00CC] focus:ring-1 focus:ring-[rgba(42,0,204,0.15)]"
              />
              <button
                type="button"
                onClick={() => handleCreateTag(cat.label)}
                disabled={isPending}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ background: '#2A00CC' }}
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
        className="w-full rounded-xl py-2.5 text-sm font-bold text-black transition-colors hover:opacity-90 disabled:opacity-50"
        style={{ background: '#00F0FF' }}
      >
        {isPending ? 'Salvataggio...' : 'Salva Associazioni Tag'}
      </button>
    </div>
  )
}
