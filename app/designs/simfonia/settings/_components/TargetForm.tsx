'use client'

import { useState } from 'react'
import { saveLocationSettings } from '../_actions'

interface Props {
  locationId: string
  currentTarget: number
}

export default function TargetForm({ locationId, currentTarget }: Props) {
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
    setSaving(true)
    setResult(null)
    const res = await saveLocationSettings(locationId, val)
    setSaving(false)
    setResult(res?.error ? { error: res.error } : { ok: true })
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-base font-bold text-gray-800">Obiettivi Annuali</h2>
      <p className="mt-1 mb-5 text-sm text-gray-500">
        Obiettivo annuale di contratti attivati (per il widget dashboard).
      </p>

      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
            Target Annuale
          </label>
          <input
            type="number"
            min="1"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)] transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl px-5 py-2.5 text-sm font-bold text-black transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: '#00F0FF' }}
        >
          {saving ? '...' : 'Salva'}
        </button>
      </form>
      {result?.error && <p className="mt-2 text-sm text-red-600">{result.error}</p>}
      {result?.ok && <p className="mt-2 text-sm text-green-600">Salvato.</p>}
    </div>
  )
}
