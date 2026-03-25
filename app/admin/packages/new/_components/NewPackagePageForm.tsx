'use client'

import { useState } from 'react'
import { createPackage } from '../../_actions'

const FIELD = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500'
const INPUT = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-all duration-150 focus:ring-1 focus:ring-gray-300'

export default function NewPackagePageForm() {
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
    }
    // on success: server action redirects to /admin/packages
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={FIELD}>Name</label>
          <input name="name" required placeholder="Gym CRM" className={INPUT} />
        </div>
        <div>
          <label className={FIELD}>Slug</label>
          <input name="slug" required placeholder="gym-crm" className={INPUT} />
        </div>
      </div>

      <div>
        <label className={FIELD}>Description</label>
        <textarea
          name="description"
          rows={3}
          placeholder="Optional description…"
          className={`${INPUT} resize-none`}
        />
      </div>

      <div>
        <label className={FIELD}>Price Monthly ($)</label>
        <input
          name="price_monthly"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          className={INPUT}
        />
      </div>

      <div>
        <label className={FIELD}>Status</label>
        <select name="status" defaultValue="active" className={INPUT}>
          <option value="active">Active</option>
          <option value="hidden">Hidden</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      <div className="flex gap-6 text-sm text-gray-700">
        <label className="flex cursor-pointer items-center gap-2 select-none">
          <input type="hidden" name="auto_install" value="false" />
          <input type="checkbox" name="auto_install" value="true" className="rounded border-gray-300" />
          Auto Install
        </label>
        <label className="flex cursor-pointer items-center gap-2 select-none">
          <input type="hidden" name="auto_apply_design" value="false" />
          <input type="checkbox" name="auto_apply_design" value="true" className="rounded border-gray-300" />
          Auto Apply Design
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-[#2A00CC] py-2.5 text-sm font-medium text-white transition-all duration-150 ease-out hover:bg-[#1A0099] disabled:opacity-40"
      >
        {saving ? 'Creating…' : 'Create Package'}
      </button>
    </form>
  )
}
