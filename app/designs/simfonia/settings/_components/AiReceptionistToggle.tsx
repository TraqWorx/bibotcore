'use client'

import { useState } from 'react'

export default function AiReceptionistToggle({
  locationId,
  initialEnabled,
  demoMode = false,
}: {
  locationId: string
  initialEnabled: boolean
  demoMode?: boolean
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    const newValue = !enabled
    setEnabled(newValue)
    if (demoMode) return
    setSaving(true)
    await fetch('/api/portal/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, aiReceptionist: newValue }),
    })
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-gray-200/70 bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-gray-900">AI receptionist</h3>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          Risponde automaticamente ai nuovi messaggi, chiede nome e motivo del contatto, e indirizza al collaboratore scelto.
        </p>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
          enabled ? 'bg-emerald-500' : 'bg-gray-200'
        } disabled:opacity-50`}
        aria-pressed={enabled}
      >
        <span
          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
