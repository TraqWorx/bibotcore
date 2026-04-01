'use client'

import { useState } from 'react'
import { setLocationPlan } from '../_actions'
import { ad } from '@/lib/admin/ui'

interface Props {
  locationId: string
  currentPlanId: string | null
  plans: { ghl_plan_id: string; name: string; price_monthly: number | null }[]
}

export default function PlanSelector({ locationId, currentPlanId, plans }: Props) {
  const [value, setValue] = useState(currentPlanId ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    setValue(next)
    setSaving(true)
    setSaved(false)
    await setLocationPlan(locationId, next || null)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value}
        onChange={handleChange}
        disabled={saving}
        className="rounded-xl border border-gray-200/90 bg-white px-2 py-1 text-xs text-gray-700 outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10 disabled:opacity-50"
      >
        <option value="">— no plan —</option>
        {plans.map((p) => (
          <option key={p.ghl_plan_id} value={p.ghl_plan_id}>
            {p.name}{p.price_monthly != null ? ` (€${p.price_monthly}/mo)` : ''}
          </option>
        ))}
      </select>
      {saving && <span className="text-[10px] text-gray-400">saving…</span>}
      {saved && <span className="text-[10px] text-green-600">✓</span>}
    </div>
  )
}
