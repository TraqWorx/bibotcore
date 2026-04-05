'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { sf } from '@/lib/simfonia/ui'

type ViewMode = 'week' | 'month'

interface CalendarEvent {
  id: string
  title?: string
  startTime?: string
  endTime?: string
  appointmentStatus?: string
  assignedUserId?: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
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
  confirmed: { bg: '#edf7f1', text: '#5f8f76', border: '#d7e8de' },
  showed: { bg: '#edf7f1', text: '#5f8f76', border: '#d7e8de' },
  cancelled: { bg: '#f7e7e3', text: '#9e6e63', border: '#edd9d4' },
  noshow: { bg: 'var(--shell-soft)', text: 'var(--shell-muted)', border: 'var(--shell-line)' },
  new: {
    bg: 'color-mix(in srgb, var(--brand) 10%, white)',
    text: 'var(--brand)',
    border: 'color-mix(in srgb, var(--brand) 22%, #e5e7eb)',
  },
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confermato',
  showed: 'Presente',
  cancelled: 'Cancellato',
  noshow: 'Non presente',
  new: 'Nuovo',
}

/** Left accent on event cards (booking-app style) */
const STATUS_ACCENT: Record<string, string> = {
  confirmed: 'border-l-emerald-500',
  showed: 'border-l-emerald-500',
  cancelled: 'border-l-red-400',
  noshow: 'border-l-gray-400',
  new: 'border-l-[var(--brand)]',
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
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(isAdmin ? null : currentUserId)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
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

  // Month view data
  const monthDays = useMemo(() => {
    const monthDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
    const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1 // Monday-based
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < startDay; i++) cells.push(null)
    for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), i))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [monthOffset, today])

  const monthEvents = filteredEvents

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      {/* Main calendar — booking-style soft shell */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] bg-[var(--shell-surface)] ring-1 ring-[var(--shell-line)] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_12px_40px_-24px_rgba(15,23,42,0.12)]">
        {/* Navigation */}
        <div className="flex flex-col gap-4 border-b border-[var(--shell-line)] bg-[color:color-mix(in_srgb,var(--shell-surface)_88%,white_12%)] px-4 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
          <div className="min-w-0 space-y-2">
            <p className="truncate text-lg font-bold tracking-tight text-[var(--foreground)] sm:text-xl">
              {viewMode === 'week'
                ? formatDateRange(monday, sunday)
                : new Date(today.getFullYear(), today.getMonth() + monthOffset).toLocaleDateString('it-IT', {
                    month: 'long',
                    year: 'numeric',
                  })}
            </p>
            <p className="text-xs font-medium text-[var(--shell-muted)]">
              {viewMode === 'week' ? 'Vista settimanale' : 'Vista mensile'}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="inline-flex items-center rounded-full border border-[var(--shell-line)] bg-[var(--shell-surface)] p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('week')}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    viewMode === 'week'
                      ? 'bg-[var(--foreground)] text-white shadow-sm'
                      : 'text-[var(--shell-muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  Settimana
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('month')}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    viewMode === 'month'
                      ? 'bg-[var(--foreground)] text-white shadow-sm'
                      : 'text-[var(--shell-muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  Mese
                </button>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setWeekOffset(0)
                setMonthOffset(0)
              }}
              className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                weekOffset === 0 && monthOffset === 0
                  ? 'bg-brand text-white shadow-md shadow-brand/25'
                  : 'border border-[var(--shell-line)] bg-[var(--shell-surface)] text-[var(--shell-muted)] shadow-sm hover:bg-[var(--shell-soft)]'
              }`}
            >
              Oggi
            </button>
            <div className="flex items-center gap-1 rounded-full border border-[var(--shell-line)] bg-[var(--shell-surface)] p-1 shadow-sm">
              <button
                type="button"
                onClick={() => (viewMode === 'week' ? setWeekOffset((w) => w - 1) : setMonthOffset((m) => m - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--shell-muted)] transition-colors hover:bg-[var(--shell-soft)] hover:text-[var(--foreground)]"
                aria-label="Precedente"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => (viewMode === 'week' ? setWeekOffset((w) => w + 1) : setMonthOffset((m) => m + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--shell-muted)] transition-colors hover:bg-[var(--shell-soft)] hover:text-[var(--foreground)]"
                aria-label="Successiva"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>

        {/* Week view */}
        {viewMode === 'week' && (
          <>
            <div className="grid grid-cols-7 gap-2 p-3 sm:gap-3 sm:p-4">
              {days.map((day, i) => {
                const isToday = isSameDay(day, today)
                const count = eventsByDay[i].events.length
                return (
                  <div
                    key={i}
                    className={`rounded-[22px] px-2 py-3 text-center shadow-sm transition-all sm:px-3 sm:py-3.5 ${
                      isToday
                        ? 'bg-brand text-white ring-2 ring-brand/25 ring-offset-2 ring-offset-[var(--shell-surface)] shadow-md shadow-brand/20'
                        : 'border border-[var(--shell-line)] bg-[var(--shell-canvas)] text-[var(--foreground)] hover:border-brand/20 hover:bg-[var(--shell-soft)]'
                    }`}
                  >
                    <p
                      className={`text-[10px] font-bold uppercase tracking-[0.14em] sm:text-[11px] ${
                        isToday ? 'text-white/80' : 'text-[var(--shell-muted)]'
                      }`}
                    >
                      {DAY_NAMES[i]}
                    </p>
                    <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${isToday ? 'text-white' : 'text-[var(--foreground)]'}`}>
                      {day.getDate()}
                    </p>
                    {count > 0 && (
                      <span
                        className={`mt-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isToday ? 'bg-white/20 text-white' : 'bg-brand/10 text-brand'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="grid min-h-[440px] grid-cols-7 gap-2 px-3 pb-4 sm:gap-3 sm:px-4 sm:pb-5">
              {eventsByDay.map(({ events: dayEvents }, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded-[24px] border border-[var(--shell-line)] bg-[var(--shell-canvas)] p-2 shadow-[0_10px_30px_-22px_rgba(15,23,42,0.1)] sm:p-2.5"
                >
                  {dayEvents.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center py-10">
                      <span className="text-[11px] font-medium text-[var(--shell-muted)]/45">Libero</span>
                    </div>
                  ) : (
                    dayEvents.map((event) => {
                      const status = event.appointmentStatus ?? ''
                      const style = STATUS_STYLE[status]
                      const accent = STATUS_ACCENT[status] ?? 'border-l-gray-300'
                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => setSelectedEvent(event)}
                          className={`w-full cursor-pointer rounded-[18px] border border-[var(--shell-line)] border-l-[3px] p-2.5 text-left text-xs shadow-[0_10px_24px_-20px_rgba(23,21,18,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-3 ${accent}`}
                          style={style ? { background: style.bg, color: style.text } : { color: '#374151' }}
                        >
                          <p className="truncate font-bold leading-tight">{event.title ?? 'Appuntamento'}</p>
                          {event.contactName && <p className="mt-1 truncate text-[11px] font-medium opacity-85">{event.contactName}</p>}
                          {event.startTime && (
                            <p className="mt-1.5 text-[11px] font-semibold tabular-nums opacity-70">
                              {new Date(event.startTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                              {event.endTime &&
                                ` – ${new Date(event.endTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
                            </p>
                          )}
                          {event.appointmentStatus && (
                            <p className="mt-2 text-[9px] font-bold uppercase tracking-wider opacity-55">
                              {STATUS_LABELS[status] ?? status}
                            </p>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Month view */}
        {viewMode === 'month' && (
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1.5 pb-3">
              {DAY_NAMES.map((d) => (
                <div key={d} className="py-2 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--shell-muted)]">{d}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {monthDays.map((day, i) => {
                if (!day)
                  return (
                    <div
                      key={i}
                      className="min-h-[88px] rounded-[20px] bg-[var(--shell-canvas)]/60 ring-1 ring-[var(--shell-line)]"
                    />
                  )
                const isToday = isSameDay(day, today)
                const dayEvts = monthEvents.filter((e) => e.startTime && isSameDay(new Date(e.startTime), day))
                return (
                  <div
                    key={i}
                    className={`flex min-h-[96px] flex-col rounded-[20px] p-1.5 ring-1 transition-shadow sm:p-2 ${
                      isToday
                        ? 'bg-brand/5 ring-brand/25 shadow-sm'
                        : 'bg-[var(--shell-surface)] ring-[var(--shell-line)] hover:ring-brand/18'
                    }`}
                  >
                    <p
                      className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                        isToday ? 'bg-brand text-white shadow-sm' : 'text-[var(--shell-muted)]'
                      }`}
                    >
                      {day.getDate()}
                    </p>
                    <div className="min-h-0 flex-1 space-y-1">
                      {dayEvts.slice(0, 2).map((e) => {
                        const s = STATUS_STYLE[e.appointmentStatus ?? '']
                        const ac = STATUS_ACCENT[e.appointmentStatus ?? ''] ?? 'border-l-gray-300'
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => setSelectedEvent(e)}
                            className={`w-full cursor-pointer truncate rounded-xl border border-[var(--shell-line)] border-l-2 py-1 pl-1.5 pr-1 text-left text-[9px] font-semibold leading-tight shadow-sm ${ac}`}
                            style={s ? { background: s.bg, color: s.text } : { background: 'var(--shell-canvas)', color: 'var(--shell-muted)' }}
                          >
                            {e.startTime &&
                              new Date(e.startTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}{' '}
                            {e.contactName ?? e.title ?? ''}
                          </button>
                        )
                      })}
                      {dayEvts.length > 2 && (
                        <p className="text-[9px] font-semibold text-[var(--shell-muted)]">+{dayEvts.length - 2}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar — team & detail */}
      <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-6 lg:w-[280px]">
        {/* Event detail */}
        {selectedEvent && (
          <div className={`${sf.card} ${sf.cardPadding} ring-1 ring-[var(--shell-line)] shadow-[0_12px_40px_-20px_rgba(15,23,42,0.12)]`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className={sf.sectionLabel}>Dettaglio</h3>
              <button onClick={() => setSelectedEvent(null)} className="text-[var(--shell-muted)] hover:text-[var(--foreground)]">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2.5">
              <p className="text-sm font-bold text-[var(--foreground)]">{selectedEvent.title ?? 'Appuntamento'}</p>
              {selectedEvent.contactName && (
                <div>
                  <p className="text-[10px] text-[var(--shell-muted)]">Contatto</p>
                  <p className="text-xs font-medium text-[var(--foreground)]">{selectedEvent.contactName}</p>
                </div>
              )}
              {selectedEvent.contactEmail && (
                <div>
                  <p className="text-[10px] text-[var(--shell-muted)]">Email</p>
                  <p className="text-xs text-[var(--shell-muted)]">{selectedEvent.contactEmail}</p>
                </div>
              )}
              {selectedEvent.contactPhone && (
                <div>
                  <p className="text-[10px] text-[var(--shell-muted)]">Telefono</p>
                  <p className="text-xs text-[var(--shell-muted)]">{selectedEvent.contactPhone}</p>
                </div>
              )}
              {selectedEvent.startTime && (
                <div>
                  <p className="text-[10px] text-[var(--shell-muted)]">Data e ora</p>
                  <p className="text-xs font-medium text-[var(--foreground)]">
                    {new Date(selectedEvent.startTime).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <p className="text-xs text-[var(--shell-muted)]">
                    {new Date(selectedEvent.startTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    {selectedEvent.endTime && ` – ${new Date(selectedEvent.endTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
              )}
              {selectedEvent.appointmentStatus && (
                <div>
                  <p className="text-[10px] text-[var(--shell-muted)]">Stato</p>
                  <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    selectedEvent.appointmentStatus === 'confirmed' || selectedEvent.appointmentStatus === 'showed' ? 'bg-emerald-50 text-emerald-700' :
                    selectedEvent.appointmentStatus === 'cancelled' ? 'bg-red-50 text-red-600' :
                    'bg-[var(--shell-canvas)] text-[var(--shell-muted)]'
                  }`}>
                    {STATUS_LABELS[selectedEvent.appointmentStatus] ?? selectedEvent.appointmentStatus}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

          {users.length > 0 && (
          <div className={`${sf.card} ${sf.cardPadding} ring-1 ring-[var(--shell-line)]`}>
            <h3 className={`mb-4 ${sf.sectionLabel}`}>
              {isAdmin ? 'Operatori' : 'Il mio calendario'}
            </h3>
            <div className="space-y-1.5">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                    !selectedUserId
                      ? 'border-brand/20 bg-brand/10 text-brand shadow-sm ring-2 ring-brand/15'
                      : 'border-transparent text-[var(--shell-muted)] hover:border-[var(--shell-line)] hover:bg-[var(--shell-soft)]'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ${
                      !selectedUserId ? 'bg-brand' : 'bg-[var(--shell-muted)]'
                    }`}
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
                    type="button"
                    onClick={() => (isAdmin ? setSelectedUserId(isActive ? null : user.id) : undefined)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                      !isAdmin ? 'cursor-default' : ''
                    } ${
                      isActive
                        ? 'border-brand/20 bg-brand/10 text-brand shadow-sm ring-2 ring-brand/15'
                        : 'border-transparent text-[var(--shell-muted)] hover:border-[var(--shell-line)] hover:bg-[var(--shell-soft)]'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ${
                        isActive ? 'bg-brand' : 'bg-[var(--shell-muted)]'
                      }`}
                    >
                      {initials}
                    </span>
                    <span className="truncate">{user.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
