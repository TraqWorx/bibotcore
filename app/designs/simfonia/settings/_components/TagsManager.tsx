'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createLocationTag, deleteLocationTag } from '../_actions'
import type { GhlTag } from '../_actions'

export default function TagsManager({
  locationId,
  initialTags,
}: {
  locationId: string
  initialTags: GhlTag[]
}) {
  const router = useRouter()
  const [tags, setTags] = useState<GhlTag[]>(initialTags)
  const [newTag, setNewTag] = useState('')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filteredTags = search.trim()
    ? tags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : tags

  async function handleAdd() {
    if (!newTag.trim()) return
    setAdding(true)
    setError(null)
    const result = await createLocationTag(locationId, newTag.trim())
    setAdding(false)
    if (result.error) {
      setError(result.error)
    } else {
      setNewTag('')
      router.refresh()
      // Optimistic: add to local list
      setTags((prev) => [...prev, { id: `temp-${Date.now()}`, name: newTag.trim() }].sort((a, b) => a.name.localeCompare(b.name)))
    }
  }

  async function handleDelete(tag: GhlTag) {
    setDeletingId(tag.id)
    setError(null)
    const result = await deleteLocationTag(locationId, tag.id)
    setDeletingId(null)
    if (result.error) {
      setError(result.error)
    } else {
      setTags((prev) => prev.filter((t) => t.id !== tag.id))
      router.refresh()
    }
  }

  return (
    <div className="space-y-5">
      {/* Add new tag */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          placeholder="Nuovo tag..."
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)]"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !newTag.trim()}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: '#2A00CC' }}
        >
          {adding ? '...' : 'Aggiungi'}
        </button>
      </div>

      {/* Search */}
      {tags.length > 10 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca tag..."
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)] transition-all"
        />
      )}

      {/* Tag list */}
      {filteredTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {filteredTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 capitalize"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => handleDelete(tag)}
                disabled={deletingId === tag.id}
                className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30"
                title="Elimina tag"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">
          {search ? 'Nessun tag trovato.' : 'Nessun tag presente.'}
        </p>
      )}

      <p className="text-xs text-gray-400">{tags.length} tag totali</p>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  )
}
