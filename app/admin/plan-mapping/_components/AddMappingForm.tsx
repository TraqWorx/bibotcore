'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPlanMapping } from '../_actions'
import { ad } from '@/lib/admin/ui'

interface Props {
  designs: { slug: string; name: string }[]
  plans: { ghl_plan_id: string; name: string }[]
}

export default function AddMappingForm({ designs, plans }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(formData: FormData) {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const result = await createPlanMapping(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        router.refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form action={handleSubmit} className={`${ad.panel} space-y-4`}>
      <h2 className="text-sm font-semibold text-gray-700">Add Plan Mapping</h2>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            GHL Plan
          </label>
          {plans.length > 0 ? (
            <select
              name="ghl_plan_id"
              className={ad.input}
            >
              {plans.map((p) => (
                <option key={p.ghl_plan_id} value={p.ghl_plan_id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              name="ghl_plan_id"
              required
              placeholder="Sync plans first to populate this list"
              className={ad.input}
            />
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Design
          </label>
          <select
            name="design_slug"
            className={ad.input}
          >
            {designs.length === 0 ? (
              <option value="">No designs available</option>
            ) : (
              designs.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className={ad.btnPrimary}
      >
        {saving ? 'Saving…' : success ? 'Saved!' : 'Save Mapping'}
      </button>
    </form>
  )
}
