'use client'

import { useState } from 'react'
import { createDesign } from '../_actions'
import { ad } from '@/lib/admin/ui'

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
        className={ad.btnPrimary}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        New design
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-3xl border border-gray-200/70 bg-white/95 p-6 shadow-2xl backdrop-blur-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Create New Design</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Simfonia"
                  required
                  className={ad.input}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. simfonia"
                  required
                  pattern="[a-z0-9-]+"
                  className={`${ad.input} font-mono`}
                />
                <p className="mt-1 text-[11px] text-gray-400">Lowercase letters, numbers, hyphens only</p>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setError('') }}
                  className={ad.btnSecondary}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={ad.btnPrimary}
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
