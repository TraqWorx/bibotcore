'use client'

import { useState } from 'react'
import { saveClosedDays } from '../_actions'
import { sf } from '@/lib/simfonia/ui'

const accentFill = {
  background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 88%, white) 100%)',
} as const

interface Props {
  locationId: string
  initialDays: string[]
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function getDateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start + 'T12:00:00')
  const endDate = new Date(end + 'T12:00:00')
  if (cur > endDate) return getDateRange(end, start)
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
  const [days, setDays] = useState<string[]>(() => [...initialDays].sort())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null)

  function handleAdd() {
    if (!startDate) return
    const newDays = endDate && endDate !== startDate ? getDateRange(startDate, endDate) : [startDate]
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

  const rangePreview =
    startDate && endDate && endDate !== startDate
      ? getDateRange(startDate, endDate).filter((d) => !days.includes(d)).length
      : 0

  return (
    <div className={sf.formCard}>
      <h2 className={sf.formTitle}>Giorni di chiusura</h2>
      <p className={`${sf.formDesc} mb-5`}>
        Seleziona i giorni in cui l&apos;attivit&agrave; &egrave; chiusa. Verranno esclusi dal conteggio dei giorni
        lavorativi.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className={sf.formLabel}>Da</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={sf.inputFull} />
        </div>
        <div className="min-w-0 flex-1">
          <label className={sf.formLabel}>
            A <span className="font-normal normal-case text-gray-400">(opzionale)</span>
          </label>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className={sf.inputFull}
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!startDate}
          className="shrink-0 rounded-2xl px-5 py-2.5 text-sm font-bold text-gray-900 shadow-md transition hover:brightness-[1.02] disabled:opacity-45"
          style={accentFill}
        >
          {rangePreview > 1 ? `Aggiungi ${rangePreview} gg` : 'Aggiungi'}
        </button>
      </div>

      {days.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {days.map((day) => (
            <span
              key={day}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200/80 bg-gray-50/90 px-3 py-1 text-sm text-gray-700 shadow-sm"
            >
              {formatDate(day)}
              <button
                type="button"
                onClick={() => handleRemove(day)}
                className="text-sm font-bold text-red-400 transition hover:text-red-600"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {days.length === 0 && <p className="mt-5 text-sm text-gray-500">Nessun giorno di chiusura impostato.</p>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-2xl px-5 py-2.5 text-sm font-bold text-gray-900 shadow-md transition hover:brightness-[1.02] disabled:opacity-45"
          style={accentFill}
        >
          {saving ? '…' : 'Salva'}
        </button>
        {days.length > 0 && (
          <span className="text-xs text-gray-500">
            {days.length} giorn{days.length === 1 ? 'o' : 'i'}
          </span>
        )}
      </div>

      {result?.error && <p className="mt-2 text-sm font-medium text-red-600">{result.error}</p>}
      {result?.ok && <p className="mt-2 text-sm font-medium text-emerald-600">Salvato.</p>}
    </div>
  )
}
