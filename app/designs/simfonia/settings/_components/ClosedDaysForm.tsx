'use client'

import { useState } from 'react'
import { saveClosedDays } from '../_actions'

interface Props {
  locationId: string
  initialDays: string[]
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function ClosedDaysForm({ locationId, initialDays }: Props) {
  const [days, setDays] = useState<string[]>(() =>
    [...initialDays].sort()
  )
  const [dateValue, setDateValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null)

  function handleAdd() {
    if (!dateValue) return
    if (days.includes(dateValue)) return
    setDays((prev) => [...prev, dateValue].sort())
    setDateValue('')
    setResult(null)
  }

  function handleRemove(day: string) {
    setDays((prev) => prev.filter((d) => d !== day))
    setResult(null)
  }

  async function handleSave() {
    setSaving(true)
    setResult(null)
    const res = await saveClosedDays(locationId, days)
    setSaving(false)
    setResult(res?.error ? { error: res.error } : { ok: true })
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-base font-bold text-gray-800">Giorni di Chiusura</h2>
      <p className="mt-1 mb-5 text-sm text-gray-500">
        Seleziona i giorni in cui l&apos;attivit&agrave; &egrave; chiusa. Verranno esclusi dal conteggio dei giorni lavorativi.
      </p>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
            Aggiungi Data
          </label>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)] transition-all"
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!dateValue}
          className="rounded-xl px-5 py-2.5 text-sm font-bold text-black transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: '#00F0FF' }}
        >
          Aggiungi
        </button>
      </div>

      {days.length > 0 && (
        <div className="mt-5 space-y-2">
          {days.map((day) => (
            <div
              key={day}
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5"
            >
              <span className="text-sm text-gray-700">{formatDate(day)}</span>
              <button
                type="button"
                onClick={() => handleRemove(day)}
                className="text-sm font-bold text-red-500 hover:text-red-700 transition-colors"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {days.length === 0 && (
        <p className="mt-5 text-sm text-gray-400">Nessun giorno di chiusura impostato.</p>
      )}

      <div className="mt-5">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl px-5 py-2.5 text-sm font-bold text-black transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: '#00F0FF' }}
        >
          {saving ? '...' : 'Salva'}
        </button>
      </div>

      {result?.error && <p className="mt-2 text-sm text-red-600">{result.error}</p>}
      {result?.ok && <p className="mt-2 text-sm text-green-600">Salvato.</p>}
    </div>
  )
}
