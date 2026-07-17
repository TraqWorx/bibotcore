'use client'

import { useState } from 'react'
import { PLAN_LIST } from '@/lib/stripe/plans'

export default function SubscribeButton({ locationId }: { locationId: string }) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  async function post(planId: string, confirm: boolean) {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, plan: planId, confirm }),
    })
    return { ok: res.ok, data: await res.json().catch(() => ({})) }
  }

  async function handleClick(planId: string) {
    setLoadingPlan(planId)
    try {
      const { ok, data } = await post(planId, false)
      if (!ok) { setLoadingPlan(null); return }

      if (data.mode === 'checkout') {
        window.location.href = data.url
        return
      }
      if (data.mode === 'saved_card') {
        const yes = window.confirm(
          `Subscribe this location to ${data.planName} (${data.amountLabel})? ` +
          `Your saved ${data.brand} card ending ${data.last4} will be charged now.`,
        )
        if (!yes) { setLoadingPlan(null); return }
        const charged = await post(planId, true)
        if (charged.ok && charged.data.subscribed) {
          window.location.reload()
          return
        }
        if (charged.ok && charged.data.mode === 'checkout') {
          window.location.href = charged.data.url
          return
        }
      }
    } catch {
      // fall through to reset
    }
    setLoadingPlan(null)
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
          {loadingPlan === plan.id ? 'Loading…' : `Subscribe ${plan.name}`}
        </button>
      ))}
    </div>
  )
}
