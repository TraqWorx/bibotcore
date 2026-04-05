'use client'

import { useState } from 'react'
import { saveLocationSettings } from '../_actions'
import { sf } from '@/lib/simfonia/ui'

const accentFill = {
  background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 88%, white) 100%)',
} as const

interface Props {
  locationId: string
  currentTarget: number
  demoMode?: boolean
}

export default function TargetForm({ locationId, currentTarget, demoMode = false }: Props) {
  const [target, setTarget] = useState(String(currentTarget))
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const val = parseInt(target, 10)
    if (!val || val < 1) {
      setResult({ error: 'Target non valido' })
      return
    }
    if (demoMode) {
      setResult({ ok: true })
      return
    }
    setSaving(true)
    setResult(null)
    const res = await saveLocationSettings(locationId, val)
    setSaving(false)
    setResult(res?.error ? { error: res.error } : { ok: true })
  }

  return (
    <div className={sf.formCard}>
      <h2 className={sf.formTitle}>Obiettivi annuali</h2>
      <p className={`${sf.formDesc} mb-5`}>
        Obiettivo annuale di contratti attivati (per il widget dashboard).
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className={sf.formLabel}>Target annuale</label>
          <input
            type="number"
            min="1"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={demoMode}
            className={sf.inputFull}
          />
        </div>
        <button
          type="submit"
          disabled={demoMode || saving}
          className="rounded-2xl px-6 py-2.5 text-sm font-bold text-gray-900 shadow-md transition hover:brightness-[1.02] disabled:opacity-45"
          style={accentFill}
        >
          {saving ? '…' : 'Salva'}
        </button>
      </form>
      {result?.error && <p className="mt-2 text-sm font-medium text-red-600">{result.error}</p>}
      {result?.ok && <p className="mt-2 text-sm font-medium text-emerald-600">Salvato.</p>}
    </div>
  )
}
