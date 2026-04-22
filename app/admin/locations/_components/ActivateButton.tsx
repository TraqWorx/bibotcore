'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setLocationPlan } from '../_actions'

interface Plan {
  ghl_plan_id: string
  name: string
  price_monthly: number | null
}

export default function ActivateButton({ locationId, isActive, currentPlanId, plans }: {
  locationId: string
  isActive: boolean
  currentPlanId: string | null
  plans: Plan[]
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(currentPlanId ?? '')
  const router = useRouter()

  async function handleActivate() {
    setLoading(true)
    // Activate subscription
    await fetch('/api/admin/subscription/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId }),
    })
    // Set the GHL plan if selected
    if (selectedPlan) {
      await setLocationPlan(locationId, selectedPlan)
    }
    setOpen(false)
    setLoading(false)
    router.refresh()
  }

  async function handleDeactivate() {
    if (!confirm('Deactivate this location? Dashboard will stop working.')) return
    setLoading(true)
    await fetch('/api/admin/subscription/deactivate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId }),
    })
    setLoading(false)
    router.refresh()
  }

  async function handlePlanChange(planId: string) {
    setLoading(true)
    await setLocationPlan(locationId, planId || null)
    setLoading(false)
    router.refresh()
  }

  if (isActive && !open) {
    return (
      <div className="flex items-center gap-1">
        <button onClick={() => setOpen(true)} className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50">
          Plan
        </button>
        <button onClick={handleDeactivate} disabled={loading} className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
          {loading ? '...' : 'Deactivate'}
        </button>
      </div>
    )
  }

  if (!isActive && !open) {
    return (
      <button onClick={() => setOpen(true)} disabled={loading} className="rounded-lg border border-emerald-200 px-2.5 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
        Activate
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={selectedPlan}
        onChange={(e) => {
          setSelectedPlan(e.target.value)
          if (isActive) handlePlanChange(e.target.value)
        }}
        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] outline-none"
      >
        <option value="">No plan</option>
        {plans.map((p) => (
          <option key={p.ghl_plan_id} value={p.ghl_plan_id}>
            {p.name} {p.price_monthly != null ? `€${p.price_monthly}` : ''}
          </option>
        ))}
      </select>
      {!isActive && (
        <button onClick={handleActivate} disabled={loading} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {loading ? '...' : 'Activate'}
        </button>
      )}
      <button onClick={() => setOpen(false)} className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-50">x</button>
    </div>
  )
}
