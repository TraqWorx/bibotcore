'use client'

import { useState } from 'react'
import { PLAN_LIST } from '@/lib/stripe/plans'

export default function ChangePlanButton({ locationId, currentPlan }: { locationId: string; currentPlan: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const target = PLAN_LIST.find((p) => p.id !== currentPlan)
  if (!target) return null

  const upgrade = target.priceCents > (PLAN_LIST.find((p) => p.id === currentPlan)?.priceCents ?? 0)

  async function handleChange() {
    if (!target) return
    const note = upgrade
      ? `You'll be charged the prorated difference for the rest of this billing period now.`
      : `The prorated difference is credited against your next invoice.`
    if (!confirm(`Switch this location to ${target.name} (${target.priceLabel})? ${note}`)) return
    setLoading(true)
    setError(null)
    const res = await fetch('/api/stripe/change-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, plan: target.id }),
    })
    if (res.ok) {
      window.location.reload()
      return
    }
    const data = await res.json().catch(() => ({}))
    setError(data.error ?? 'Plan change failed')
    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={handleChange}
        disabled={loading}
        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? 'Switching...' : `${upgrade ? '↑' : '↓'} ${target.name} ${target.priceLabel}`}
      </button>
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
    </div>
  )
}
