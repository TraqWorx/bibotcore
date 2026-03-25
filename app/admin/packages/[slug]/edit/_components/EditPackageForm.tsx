'use client'

import { useState } from 'react'
import { updatePackage } from '../../../_actions'

const FIELD = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500'
const INPUT = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-all duration-150 focus:ring-1 focus:ring-gray-300'

interface Pkg {
  slug: string
  name: string
  description?: string | null
  price_monthly?: number | null
  auto_install?: boolean | null
  auto_apply_design?: boolean | null
  status?: string | null
}

export default function EditPackageForm({ pkg }: { pkg: Pkg }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const result = await updatePackage(pkg.slug, new FormData(e.currentTarget))
    if (result?.error) {
      setError(result.error)
      setSaving(false)
    }
    // on success: server action redirects to /admin/packages
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
      {/* Slug and name shown read-only */}
      <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm">
        <span className="text-gray-400">Slug: </span>
        <span className="font-mono text-gray-700">{pkg.slug}</span>
        <span className="ml-4 text-gray-400">Name: </span>
        <span className="font-medium text-gray-900">{pkg.name}</span>
      </div>

      <div>
        <label className={FIELD}>Description</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={pkg.description ?? ''}
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
          defaultValue={pkg.price_monthly ?? ''}
          placeholder="0.00"
          className={INPUT}
        />
      </div>

      <div>
        <label className={FIELD}>Status</label>
        <select name="status" defaultValue={pkg.status ?? 'active'} className={INPUT}>
          <option value="active">Active</option>
          <option value="hidden">Hidden</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      <div className="flex gap-6 text-sm text-gray-700">
        <label className="flex cursor-pointer items-center gap-2 select-none">
          <input type="hidden" name="auto_install" value="false" />
          <input
            type="checkbox"
            name="auto_install"
            value="true"
            defaultChecked={pkg.auto_install ?? false}
            className="rounded border-gray-300"
          />
          Auto Install
        </label>
        <label className="flex cursor-pointer items-center gap-2 select-none">
          <input type="hidden" name="auto_apply_design" value="false" />
          <input
            type="checkbox"
            name="auto_apply_design"
            value="true"
            defaultChecked={pkg.auto_apply_design ?? false}
            className="rounded border-gray-300"
          />
          Auto Apply Design
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-[#2A00CC] py-2.5 text-sm font-medium text-white transition-all duration-150 ease-out hover:bg-[#1A0099] disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  )
}
