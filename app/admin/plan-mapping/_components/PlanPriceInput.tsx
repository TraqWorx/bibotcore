'use client'

import { useState } from 'react'
import { savePlanPrice } from '../_actions'

export default function PlanPriceInput({ ghlPlanId, current }: { ghlPlanId: string; current: number | null }) {
  const [value, setValue] = useState(current != null ? String(current) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleBlur() {
    const parsed = value.trim() ? parseFloat(value) : null
    if (value.trim() && (isNaN(parsed!) || parsed! < 0)) return
    if (parsed === current) return
    setSaving(true)
    await savePlanPrice(ghlPlanId, parsed)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-400">€</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => { setValue(e.target.value); setSaved(false) }}
        onBlur={handleBlur}
        placeholder="0.00"
        className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none focus:border-[#2A00CC] focus:ring-1 focus:ring-[#2A00CC]"
      />
      {saving && <span className="text-[10px] text-gray-400">saving…</span>}
      {saved && <span className="text-[10px] text-green-600">✓</span>}
    </div>
  )
}
