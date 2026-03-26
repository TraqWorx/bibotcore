'use client'

import { useState, useMemo } from 'react'

interface CalendarEvent {
  id: string
  title?: string
  startTime?: string
  endTime?: string
  appointmentStatus?: string
  assignedUserId?: string
}

interface User {
  id: string
  name: string
}

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' }
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} ${start.toLocaleDateString('it-IT', { month: 'long' })} ${start.getFullYear()}`
  }
  return `${start.toLocaleDateString('it-IT', opts)} – ${end.toLocaleDateString('it-IT', opts)} ${end.getFullYear()}`
}

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  confirmed: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  showed: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  cancelled: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  noshow: { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' },
  new: { bg: '#EEF2FF', text: '#2A00CC', border: 'rgba(42,0,204,0.2)' },
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confermato',
  showed: 'Presente',
  cancelled: 'Cancellato',
  noshow: 'Non presente',
  new: 'Nuovo',
}

export default function WeekCalendar({
  events,
  users,
  isAdmin,
  currentUserId,
}: {
  events: CalendarEvent[]
  users: User[]
  isAdmin: boolean
  currentUserId: string | null
}) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(isAdmin ? null : currentUserId)
  const today = useMemo(() => new Date(), [])

  const monday = useMemo(() => {
    const d = getMonday(today)
    d.setDate(d.getDate() + weekOffset * 7)
    return d
  }, [today, weekOffset])

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        return d
      }),
    [monday]
  )

  const sunday = days[6]

  const filteredEvents = selectedUserId
    ? events.filter((e) => e.assignedUserId === selectedUserId)
    : events

  const eventsByDay = days.map((day) => ({
    day,
    events: filteredEvents
      .filter((e) => e.startTime && isSameDay(new Date(e.startTime), day))
      .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime()),
  }))

  return (
    <div className="flex gap-6">
      {/* Calendar */}
      <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white">
        {/* Navigation header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <p className="text-sm font-semibold text-gray-900">{formatDateRange(monday, sunday)}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded-xl px-4 py-1.5 text-xs font-semibold transition-all duration-150 ease-out"
              style={
                weekOffset === 0
                  ? { background: '#2A00CC', color: 'white' }
                  : { background: 'white', color: '#6B7280', border: '1px solid #E5E7EB' }
              }
            >
              Oggi
            </button>
            <div className="flex items-center rounded-xl border border-gray-200">
              <button
                onClick={() => setWeekOffset((w) => w - 1)}
                className="flex h-8 w-8 items-center justify-center text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 rounded-l-xl"
                aria-label="Settimana precedente"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="h-4 w-px bg-gray-200" />
              <button
                onClick={() => setWeekOffset((w) => w + 1)}
                className="flex h-8 w-8 items-center justify-center text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 rounded-r-xl"
                aria-label="Settimana successiva"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {days.map((day, i) => {
            const isToday = isSameDay(day, today)
            const count = eventsByDay[i].events.length
            return (
              <div
                key={i}
                className={`border-r border-gray-200 p-3 text-center last:border-r-0 ${
                  isToday ? 'bg-[#2A00CC]' : ''
                }`}
              >
                <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-white/70' : 'text-gray-400'}`}>
                  {DAY_NAMES[i]}
                </p>
                <p className={`mt-0.5 text-lg font-bold ${isToday ? 'text-white' : 'text-gray-900'}`}>
                  {day.getDate()}
                </p>
                {count > 0 && (
                  <span
                    className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={
                      isToday
                        ? { background: 'rgba(255,255,255,0.2)', color: 'white' }
                        : { background: 'rgba(42,0,204,0.08)', color: '#2A00CC' }
                    }
                  >
                    {count}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Event columns */}
        <div className="grid min-h-[420px] grid-cols-7">
          {eventsByDay.map(({ events: dayEvents }, i) => (
            <div key={i} className="space-y-1.5 border-r border-gray-200 p-2 last:border-r-0">
              {dayEvents.length === 0 ? (
                <p className="mt-8 text-center text-xs text-gray-200">—</p>
              ) : (
                dayEvents.map((event) => {
                  const status = event.appointmentStatus ?? ''
                  const style = STATUS_STYLE[status]
                  return (
                    <div
                      key={event.id}
                      className="rounded-xl border p-2.5 text-xs transition-all duration-150 hover:shadow-sm"
                      style={
                        style
                          ? { background: style.bg, color: style.text, borderColor: style.border }
                          : { background: 'white', color: '#374151', borderColor: '#E5E7EB' }
                      }
                    >
                      <p className="truncate font-semibold">{event.title ?? 'Appuntamento'}</p>
                      {event.startTime && (
                        <p className="mt-0.5 opacity-70">
                          {new Date(event.startTime).toLocaleTimeString('it-IT', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {event.endTime && (
                            <>
                              {' – '}
                              {new Date(event.endTime).toLocaleTimeString('it-IT', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </>
                          )}
                        </p>
                      )}
                      {event.appointmentStatus && (
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">
                          {STATUS_LABELS[status] ?? status}
                        </p>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Operatori sidebar */}
      {users.length > 0 && (
        <div className="w-52 shrink-0">
          <div className="rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {isAdmin ? 'Operatori' : 'Il mio calendario'}
            </h3>
            <div className="space-y-1">
              {isAdmin && (
                <button
                  onClick={() => setSelectedUserId(null)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all"
                  style={
                    !selectedUserId
                      ? { background: 'rgba(42,0,204,0.08)', color: '#2A00CC' }
                      : { color: '#6B7280' }
                  }
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: !selectedUserId ? '#2A00CC' : '#9CA3AF' }}
                  >
                    T
                  </span>
                  Tutti
                </button>
              )}
              {(isAdmin ? users : users.filter((u) => u.id === currentUserId)).map((user) => {
                const isActive = selectedUserId === user.id
                const initials = user.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)
                return (
                  <button
                    key={user.id}
                    onClick={() => isAdmin ? setSelectedUserId(isActive ? null : user.id) : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all ${!isAdmin ? 'cursor-default' : ''}`}
                    style={
                      isActive
                        ? { background: 'rgba(42,0,204,0.08)', color: '#2A00CC' }
                        : { color: '#6B7280' }
                    }
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: isActive ? '#2A00CC' : '#9CA3AF' }}
                    >
                      {initials}
                    </span>
                    <span className="truncate">{user.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
