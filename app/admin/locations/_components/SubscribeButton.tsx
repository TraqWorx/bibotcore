'use client'

import { useState } from 'react'
import { PLAN_LIST } from '@/lib/stripe/plans'

export default function SubscribeButton({ locationId }: { locationId: string }) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  async function handleClick(planId: string) {
    setLoadingPlan(planId)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, plan: planId }),
    })
    if (res.ok) {
      const { url } = await res.json()
      window.location.href = url
    } else {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="inline-flex items-center gap-1">
      {PLAN_LIST.map((plan) => (
        <button
          key={plan.id}
          onClick={() => handleClick(plan.id)}
          disabled={loadingPlan !== null}
          className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          {loadingPlan === plan.id ? 'Loading...' : `Subscribe ${plan.name}`}
        </button>
      ))}
    </div>
  )
}
