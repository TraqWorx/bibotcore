'use client'

import { useState } from 'react'
import { createDesign } from '../_actions'

export default function CreateDesignButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleNameChange(val: string) {
    setName(val)
    // Auto-generate slug from name
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await createDesign(name, slug)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setOpen(false)
      setName('')
      setSlug('')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[#2A00CC] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1A0099]"
      >
        + New Design
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Create New Design</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Apulia Power"
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2A00CC] focus:ring-1 focus:ring-[#2A00CC]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. apulia-power"
                  required
                  pattern="[a-z0-9-]+"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm outline-none focus:border-[#2A00CC] focus:ring-1 focus:ring-[#2A00CC]"
                />
                <p className="mt-1 text-[11px] text-gray-400">Lowercase letters, numbers, hyphens only</p>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setError('') }}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-[#2A00CC] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1A0099] disabled:opacity-50"
                >
                  {loading ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
