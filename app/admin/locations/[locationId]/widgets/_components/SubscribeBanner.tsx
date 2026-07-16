'use client'

import { useState } from 'react'
import { PLAN_LIST } from '@/lib/stripe/plans'

export default function SubscribeBanner({ locationId }: { locationId: string }) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe(planId: string) {
    setLoadingPlan(planId)
    setError(null)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, plan: planId }),
    })
    if (res.ok) {
      const { url } = await res.json()
      window.location.href = url
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to start checkout')
      setLoadingPlan(null)
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6">
      <h3 className="text-sm font-bold text-gray-900">Subscribe to unlock this location</h3>
      <p className="mt-1 text-xs text-gray-500">Build beautiful dashboards, use AI to create any widget, and share with your clients.</p>

      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {PLAN_LIST.map((plan) => (
          <div key={plan.id} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-bold text-gray-900">{plan.name}</p>
              <p className="text-lg font-black text-brand">{plan.priceLabel}</p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                  <svg className="h-3.5 w-3.5 shrink-0 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribe(plan.id)}
              disabled={loadingPlan !== null}
              className="mt-5 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loadingPlan === plan.id ? 'Redirecting to checkout...' : `Subscribe ${plan.name} — ${plan.priceLabel}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
