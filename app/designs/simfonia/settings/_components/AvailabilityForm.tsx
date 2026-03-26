'use client'

import { useState } from 'react'
import { saveUserAvailability, type AvailabilitySlot } from '../_actions'

const DAY_LABELS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

interface GhlUser {
  id: string
  name: string
}

interface Props {
  locationId: string
  users: GhlUser[]
  initialSlots: AvailabilitySlot[]
}

function defaultSlotsForUser(userId: string): AvailabilitySlot[] {
  return Array.from({ length: 7 }, (_, i) => ({
    ghl_user_id: userId,
    day_of_week: i,
    start_time: '09:00',
    end_time: '18:00',
    enabled: i < 5, // Mon-Fri enabled by default
  }))
}

export default function AvailabilityForm({ locationId, users, initialSlots }: Props) {
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
    setSaving(true)
    setResult(null)
    const res = await saveUserAvailability(locationId, allSlots)
    setSaving(false)
    setResult(res?.error ? { error: res.error } : { ok: true })
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-base font-bold text-gray-800">Disponibilità Collaboratori</h2>
      <p className="mt-0.5 mb-4 text-xs text-gray-400">
        Configura giorni e orari disponibili per ogni collaboratore
      </p>

      {/* User selector */}
      {users.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => { setSelectedUserId(u.id); setResult(null) }}
              className="rounded-full border px-3 py-1 text-xs font-semibold transition-all"
              style={
                selectedUserId === u.id
                  ? { background: '#2A00CC', color: 'white', borderColor: '#2A00CC' }
                  : { background: 'white', color: '#6B7280', borderColor: '#e5e7eb' }
              }
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
                className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-all ${
                  slot.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
                }`}
              >
                {/* Toggle */}
                <label className="flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={slot.enabled}
                    onChange={(e) => updateSlot(slot.day_of_week, 'enabled', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
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
                  disabled={!slot.enabled}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm disabled:opacity-40"
                />
                <span className="text-xs text-gray-400">—</span>
                <input
                  type="time"
                  value={slot.end_time}
                  onChange={(e) => updateSlot(slot.day_of_week, 'end_time', e.target.value)}
                  disabled={!slot.enabled}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm disabled:opacity-40"
                />
              </div>
            ))}
          </div>

          {result?.error && <p className="mt-3 text-sm text-red-600">{result.error}</p>}
          {result?.ok && <p className="mt-3 text-sm text-green-600">Salvato con successo.</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-4 w-full rounded-xl py-2.5 text-sm font-bold text-black transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: '#00F0FF' }}
          >
            {saving ? 'Salvataggio...' : 'Salva Disponibilità'}
          </button>
        </>
      )}
    </div>
  )
}
