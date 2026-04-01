'use client'

import { useState } from 'react'

export default function AiReceptionistToggle({ locationId, initialEnabled }: { locationId: string; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    const newValue = !enabled
    setEnabled(newValue)
    setSaving(true)
    await fetch('/api/portal/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, aiReceptionist: newValue }),
    })
    setSaving(false)
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div>
        <h3 className="text-sm font-bold text-gray-800">AI Receptionist</h3>
        <p className="text-xs text-gray-400">
          Risponde automaticamente ai nuovi messaggi, chiede nome e motivo del contatto, e indirizza al collaboratore scelto.
        </p>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent ${
          enabled ? 'bg-emerald-500' : 'bg-gray-200'
        }`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </button>
    </div>
  )
}
