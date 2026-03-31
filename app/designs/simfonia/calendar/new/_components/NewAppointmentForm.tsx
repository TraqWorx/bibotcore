'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { GhlCalendar, GhlContact } from '@/lib/ghl/ghlClient'
import { createAppointment } from '../_actions'

interface GhlUser { id: string; name: string }

interface AvailabilitySlot {
  ghl_user_id: string
  day_of_week: number // 0=Mon, 6=Sun
  start_time: string  // 'HH:MM'
  end_time: string    // 'HH:MM'
  enabled: boolean
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export default function NewAppointmentForm({
  calendars,
  contacts,
  users,
  availability,
  locationId,
}: {
  calendars: GhlCalendar[]
  contacts: GhlContact[]
  users: GhlUser[]
  availability: AvailabilitySlot[]
  locationId: string
}) {
  const router = useRouter()
  const [calendarId, setCalendarId] = useState('')
  const [contactId, setContactId] = useState('')
  const [assignedUserId, setAssignedUserId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)]'

  // Get availability for selected user
  const userAvailability = useMemo(
    () => availability.filter((s) => s.ghl_user_id === assignedUserId),
    [availability, assignedUserId]
  )

  // Check if selected date is available for the user
  const selectedDayAvailability = useMemo(() => {
    if (!date || !assignedUserId) return null
    const d = new Date(date)
    // JS getDay: 0=Sun, convert to our 0=Mon
    const jsDay = d.getDay()
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1
    return userAvailability.find((s) => s.day_of_week === dayOfWeek) ?? null
  }, [date, assignedUserId, userAvailability])

  const isDayUnavailable = assignedUserId && userAvailability.length > 0 && date && (!selectedDayAvailability || !selectedDayAvailability.enabled)

  // Show availability hint
  const availabilityHint = useMemo(() => {
    if (!assignedUserId || userAvailability.length === 0) return null
    const enabledDays = userAvailability.filter((s) => s.enabled)
    if (enabledDays.length === 0) return 'Nessuna disponibilità configurata'
    return enabledDays
      .map((s) => `${DAY_LABELS[s.day_of_week]} ${s.start_time}–${s.end_time}`)
      .join(' · ')
  }, [assignedUserId, userAvailability])

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!calendarId || !date || !startTime || !endTime) {
      setError('Compila tutti i campi obbligatori.')
      return
    }

    const startDateTime = `${date}T${startTime}:00`
    const endDateTime = `${date}T${endTime}:00`

    if (new Date(endDateTime) <= new Date(startDateTime)) {
      setError('L\'orario di fine deve essere dopo l\'orario di inizio.')
      return
    }

    // Validate against availability
    if (assignedUserId && selectedDayAvailability && selectedDayAvailability.enabled) {
      if (startTime < selectedDayAvailability.start_time || endTime > selectedDayAvailability.end_time) {
        setError(`Orario fuori dalla disponibilità (${selectedDayAvailability.start_time}–${selectedDayAvailability.end_time})`)
        return
      }
    }

    if (isDayUnavailable) {
      setError('Il collaboratore non è disponibile in questo giorno.')
      return
    }

    setSaving(true)
    setError('')
    const result = await createAppointment({
      calendarId,
      contactId: contactId || undefined,
      startTime: startDateTime,
      endTime: endDateTime,
    }, locationId)
    if (result?.error) {
      setError(result.error)
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Calendar */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Calendario *</label>
          <select required className={inputClass} value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
            <option value="">Seleziona calendario</option>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Assigned user */}
        {users.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Collaboratore</label>
            <select
              className={inputClass}
              value={assignedUserId}
              onChange={(e) => { setAssignedUserId(e.target.value); setDate(''); setStartTime(''); setEndTime(''); setError('') }}
            >
              <option value="">Seleziona collaboratore (opzionale)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {availabilityHint && (
              <p className="mt-1 text-[11px] text-gray-400">{availabilityHint}</p>
            )}
          </div>
        )}

        {/* Contact */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Contatto</label>
          <select className={inputClass} value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">Seleziona contatto (opzionale)</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || c.id}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Data *</label>
          <input
            required
            type="date"
            className={`${inputClass} ${isDayUnavailable ? 'border-red-300 bg-red-50' : ''}`}
            value={date}
            onChange={(e) => { setDate(e.target.value); setError('') }}
          />
          {isDayUnavailable && (
            <p className="mt-1 text-xs text-red-500 font-medium">Il collaboratore non è disponibile in questo giorno</p>
          )}
        </div>

        {/* Time range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Inizio *</label>
            <input
              required
              type="time"
              step="60"
              className={inputClass}
              value={startTime}
              min={selectedDayAvailability?.enabled ? selectedDayAvailability.start_time : undefined}
              max={selectedDayAvailability?.enabled ? selectedDayAvailability.end_time : undefined}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Fine *</label>
            <input
              required
              type="time"
              step="60"
              className={inputClass}
              value={endTime}
              min={selectedDayAvailability?.enabled ? selectedDayAvailability.start_time : undefined}
              max={selectedDayAvailability?.enabled ? selectedDayAvailability.end_time : undefined}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
        {selectedDayAvailability?.enabled && (
          <p className="text-[11px] text-gray-400">
            Disponibile: {selectedDayAvailability.start_time} – {selectedDayAvailability.end_time}
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !!isDayUnavailable}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-40"
            style={{ background: '#2A00CC' }}
          >
            {saving ? 'Salvataggio…' : 'Salva Appuntamento'}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/designs/simfonia/calendar?locationId=${locationId}`)}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            Annulla
          </button>
        </div>
      </form>
    </div>
  )
}
