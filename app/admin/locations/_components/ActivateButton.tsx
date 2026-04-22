'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setLocationPlan } from '../_actions'

interface Plan {
  ghl_plan_id: string
  name: string
  price_monthly: number | null
}

export default function ActivateButton({ locationId, currentPlanId, plans }: {
  locationId: string
  currentPlanId: string | null
  plans: Plan[]
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(currentPlanId ?? '')
  const router = useRouter()

  async function handleSave() {
    setLoading(true)
    if (selectedPlan) {
      await setLocationPlan(locationId, selectedPlan)
    } else {
      await setLocationPlan(locationId, null)
    }
    setOpen(false)
    setLoading(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50">
        {currentPlanId ? 'Change Plan' : 'Set Plan'}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={selectedPlan}
        onChange={(e) => setSelectedPlan(e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] outline-none"
      >
        <option value="">— No plan —</option>
        {plans.map((p) => (
          <option key={p.ghl_plan_id} value={p.ghl_plan_id}>
            {p.name} {p.price_monthly != null ? `€${p.price_monthly}` : ''}
          </option>
        ))}
      </select>
      <button onClick={handleSave} disabled={loading} className="rounded-lg bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
        {loading ? '...' : 'Save'}
      </button>
      <button onClick={() => setOpen(false)} className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-50">x</button>
    </div>
  )
}
