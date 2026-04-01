'use client'

import { useState } from 'react'
import { createPackage } from '../_actions'
import { ad } from '@/lib/admin/ui'

export default function NewPackageForm() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const result = await createPackage(new FormData(e.currentTarget))
    if (result?.error) {
      setError(result.error)
      setSaving(false)
    } else {
      setOpen(false)
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={ad.btnPrimary}
      >
        New Package
      </button>
    )
  }

  return (
    <div className="rounded-3xl border border-gray-200/70 bg-white/95 p-5 shadow-sm backdrop-blur-sm">
      <h2 className="mb-4 text-sm font-bold text-gray-900">New Package</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Slug</label>
            <input
              name="slug"
              required
              className={ad.input}
              placeholder="gym-crm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Name</label>
            <input
              name="name"
              required
              className={ad.input}
              placeholder="Gym CRM"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Description</label>
          <input
            name="description"
            className={ad.input}
            placeholder="Optional description"
          />
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="hidden" name="auto_install" value="false" />
            <input
              type="checkbox"
              name="auto_install"
              value="true"
              className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand/20"
            />
            Auto Install
          </label>
          <label className="flex items-center gap-2">
            <input type="hidden" name="auto_apply_design" value="false" />
            <input
              type="checkbox"
              name="auto_apply_design"
              value="true"
              className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand/20"
            />
            Auto Apply Design
          </label>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className={ad.btnPrimary}
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={ad.btnSecondary}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
