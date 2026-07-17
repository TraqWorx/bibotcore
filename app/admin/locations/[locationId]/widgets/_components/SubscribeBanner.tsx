'use client'

import { useState } from 'react'
import { PLAN_LIST } from '@/lib/stripe/plans'

interface Confirm {
  plan: string
  planName: string
  amountLabel: string
  brand: string
  last4: string
}

export default function SubscribeBanner({ locationId }: { locationId: string }) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  async function start(planId: string) {
    setLoadingPlan(planId)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, plan: planId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to start checkout')
      } else if (data.mode === 'checkout') {
        window.location.href = data.url
        return
      } else if (data.mode === 'saved_card') {
        setConfirm(data)
      }
    } catch {
      setError('Failed to start checkout')
    }
    setLoadingPlan(null)
  }

  async function charge() {
    if (!confirm) return
    setLoadingPlan(confirm.plan)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, plan: confirm.plan, confirm: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Payment failed')
      } else if (data.subscribed) {
        window.location.reload()
        return
      } else if (data.mode === 'checkout') {
        window.location.href = data.url
        return
      }
    } catch {
      setError('Payment failed')
    }
    setConfirm(null)
    setLoadingPlan(null)
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6">
      <h3 className="text-sm font-bold text-gray-900">Subscribe to unlock this location</h3>
      <p className="mt-1 text-xs text-gray-500">Build beautiful dashboards, use AI to create any widget, and share with your clients.</p>

      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}

      {confirm ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-bold text-gray-900">Confirm subscription</p>
          <p className="mt-1 text-xs text-gray-600">
            Subscribe this location to <span className="font-semibold">{confirm.planName}</span> at{' '}
            <span className="font-semibold">{confirm.amountLabel}</span>, charged now to your saved{' '}
            {confirm.brand} card ending {confirm.last4}.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={charge}
              disabled={loadingPlan !== null}
              className="flex-1 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loadingPlan ? 'Charging…' : `Confirm — ${confirm.amountLabel}`}
            </button>
            <button
              onClick={() => setConfirm(null)}
              disabled={loadingPlan !== null}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
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
                onClick={() => start(plan.id)}
                disabled={loadingPlan !== null}
                className="mt-5 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {loadingPlan === plan.id ? 'Loading…' : `Subscribe ${plan.name} — ${plan.priceLabel}`}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
