'use client'

import { useState } from 'react'
import { saveUserAvailability, type AvailabilitySlot } from '../_actions'
import { sf } from '@/lib/simfonia/ui'

const accentFill = {
  background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 88%, white) 100%)',
} as const

const DAY_LABELS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

interface GhlUser {
  id: string
  name: string
}

interface Props {
  locationId: string
  users: GhlUser[]
  initialSlots: AvailabilitySlot[]
  demoMode?: boolean
}

export default function AvailabilityForm({ locationId, users, initialSlots, demoMode = false }: Props) {
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? '')
  const [allSlots, setAllSlots] = useState<AvailabilitySlot[]>(() => {
    // Ensure every user has 7 day slots
    const result = [...initialSlots]
    for (const user of users) {
      for (let d = 0; d < 7; d++) {
        const exists = result.find((s) => s.ghl_user_id === user.id && s.day_of_week === d)
        if (!exists) {
          result.push({
            ghl_user_id: user.id,
            day_of_week: d,
            start_time: '09:00',
            end_time: '18:00',
            enabled: d < 5,
          })
        }
      }
    }
    return result
  })
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null)

  const userSlots = allSlots
    .filter((s) => s.ghl_user_id === selectedUserId)
    .sort((a, b) => a.day_of_week - b.day_of_week)

  function updateSlot(dayOfWeek: number, field: 'start_time' | 'end_time' | 'enabled', value: string | boolean) {
    setAllSlots((prev) =>
      prev.map((s) =>
        s.ghl_user_id === selectedUserId && s.day_of_week === dayOfWeek
          ? { ...s, [field]: value }
          : s
      )
    )
    setResult(null)
  }

  async function handleSave() {
    if (demoMode) {
      setResult({ ok: true })
      return
    }
    setSaving(true)
    setResult(null)
    const res = await saveUserAvailability(locationId, allSlots)
    setSaving(false)
    setResult(res?.error ? { error: res.error } : { ok: true })
  }

  return (
    <div className={sf.formCard}>
      <h2 className={sf.formTitle}>Disponibilità collaboratori</h2>
      <p className={`${sf.formDesc} mb-4`}>
        Configura giorni e orari disponibili per ogni collaboratore.
      </p>

      {/* User selector */}
      {users.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => { setSelectedUserId(u.id); setResult(null) }}
              disabled={demoMode}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                selectedUserId === u.id
                  ? 'border-brand bg-brand text-white shadow-sm'
                  : 'border-gray-200/90 bg-white text-gray-600 hover:border-brand/25'
              }`}
            >
              {u.name}
            </button>
          ))}
        </div>
      )}

      {users.length === 0 ? (
        <p className="text-sm text-gray-400">Nessun collaboratore trovato.</p>
      ) : (
        <>
          {/* Day rows */}
          <div className="space-y-2">
            {userSlots.map((slot) => (
              <div
                key={slot.day_of_week}
                className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-2.5 transition-colors ${
                  slot.enabled
                    ? 'border-gray-200/80 bg-white/90 backdrop-blur-sm shadow-sm'
                    : 'border-gray-100 bg-gray-50/80 opacity-60'
                }`}
              >
                {/* Toggle */}
                <label className="flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={slot.enabled}
                    onChange={(e) => updateSlot(slot.day_of_week, 'enabled', e.target.checked)}
                    disabled={demoMode}
                    className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand/20"
                  />
                </label>

                {/* Day name */}
                <span className="w-24 text-sm font-medium text-gray-700">
                  {DAY_LABELS[slot.day_of_week]}
                </span>

                {/* Time inputs */}
                <input
                  type="time"
                  value={slot.start_time}
                  onChange={(e) => updateSlot(slot.day_of_week, 'start_time', e.target.value)}
                  disabled={demoMode || !slot.enabled}
                  className={`${sf.inputSm} w-auto disabled:opacity-40`}
                />
                <span className="text-xs text-gray-400">—</span>
                <input
                  type="time"
                  value={slot.end_time}
                  onChange={(e) => updateSlot(slot.day_of_week, 'end_time', e.target.value)}
                  disabled={demoMode || !slot.enabled}
                  className={`${sf.inputSm} w-auto disabled:opacity-40`}
                />
              </div>
            ))}
          </div>

          {result?.error && <p className="mt-3 text-sm text-red-600">{result.error}</p>}
          {result?.ok && <p className="mt-3 text-sm text-green-600">Salvato con successo.</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={demoMode || saving}
            className={`${sf.btnSave} mt-4 font-bold`}
            style={accentFill}
          >
            {saving ? 'Salvataggio…' : 'Salva disponibilità'}
          </button>
        </>
      )}
    </div>
  )
}
