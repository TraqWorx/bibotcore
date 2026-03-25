'use client'

import { useState } from 'react'
import { createPackage } from '../_actions'

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
        className="rounded-lg bg-[#2A00CC] px-4 py-2 text-sm text-white hover:bg-[#1A0099]"
      >
        New Package
      </button>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-semibold">New Package</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Slug</label>
            <input
              name="slug"
              required
              className="w-full rounded-lg border p-2 text-sm"
              placeholder="gym-crm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Name</label>
            <input
              name="name"
              required
              className="w-full rounded-lg border p-2 text-sm"
              placeholder="Gym CRM"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Description</label>
          <input
            name="description"
            className="w-full rounded-lg border p-2 text-sm"
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
            />
            Auto Install
          </label>
          <label className="flex items-center gap-2">
            <input type="hidden" name="auto_apply_design" value="false" />
            <input
              type="checkbox"
              name="auto_apply_design"
              value="true"
            />
            Auto Apply Design
          </label>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#2A00CC] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
