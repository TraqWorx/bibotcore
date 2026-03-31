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

/** Generate all dates between start and end (inclusive) as YYYY-MM-DD strings */
function getDateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')
  if (cur > endDate) return getDateRange(end, start) // swap if reversed
  while (cur <= endDate) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export default function ClosedDaysForm({ locationId, initialDays }: Props) {
  const [days, setDays] = useState<string[]>(() =>
    [...initialDays].sort()
  )
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null)

  function handleAdd() {
    if (!startDate) return
    const newDays = endDate && endDate !== startDate
      ? getDateRange(startDate, endDate)
      : [startDate]
    const existing = new Set(days)
    const toAdd = newDays.filter((d) => !existing.has(d))
    if (toAdd.length === 0) return
    setDays((prev) => [...prev, ...toAdd].sort())
    setStartDate('')
    setEndDate('')
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

  // Preview count for range
  const rangePreview = startDate && endDate && endDate !== startDate
    ? getDateRange(startDate, endDate).filter((d) => !days.includes(d)).length
    : 0

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-base font-bold text-gray-800">Giorni di Chiusura</h2>
      <p className="mt-1 mb-5 text-sm text-gray-500">
        Seleziona i giorni in cui l&apos;attivit&agrave; &egrave; chiusa. Verranno esclusi dal conteggio dei giorni lavorativi.
      </p>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
            Da
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)] transition-colors"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
            A <span className="font-normal text-gray-300">(opzionale)</span>
          </label>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)] transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!startDate}
          className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold text-black transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ background: '#00F0FF' }}
        >
          {rangePreview > 1 ? `Aggiungi ${rangePreview} gg` : 'Aggiungi'}
        </button>
      </div>

      {days.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {days.map((day) => (
            <span
              key={day}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-700"
            >
              {formatDate(day)}
              <button
                type="button"
                onClick={() => handleRemove(day)}
                className="text-sm font-bold text-red-400 hover:text-red-600 transition-colors"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {days.length === 0 && (
        <p className="mt-5 text-sm text-gray-400">Nessun giorno di chiusura impostato.</p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl px-5 py-2.5 text-sm font-bold text-black transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ background: '#00F0FF' }}
        >
          {saving ? '...' : 'Salva'}
        </button>
        {days.length > 0 && (
          <span className="text-xs text-gray-400">{days.length} giorn{days.length === 1 ? 'o' : 'i'}</span>
        )}
      </div>

      {result?.error && <p className="mt-2 text-sm text-red-600">{result.error}</p>}
      {result?.ok && <p className="mt-2 text-sm text-green-600">Salvato.</p>}
    </div>
  )
}
