'use client'

import { useState } from 'react'
import { useDashboardData } from './DashboardDataProvider'
import WidgetShell from './WidgetShell'

function sameDay(date: Date, iso: string) {
  const target = new Date(iso)
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth() && date.getDate() === target.getDate()
}

interface Props {
  title?: string
  options: Record<string, unknown>
}

export default function AgendaPreviewWidget({ title }: Props) {
  const { data } = useDashboardData()
  const now = new Date()
  const [selectedDay, setSelectedDay] = useState(() => now.getDate())
  const miniCalendarDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  if (!data) return null

  const appointmentPreview = data.appointmentPreview ?? []

  const monthDays = (() => {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const startOffset = first.getDay()
    const cells: Array<number | null> = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let i = 1; i <= daysInMonth; i++) cells.push(i)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  })()

  const selectedAppointments = appointmentPreview.filter((item) => {
    if (!item.startTime) return false
    const date = new Date(item.startTime)
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === selectedDay
  })

  return (
    <WidgetShell>
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--shell-muted)]">{title ?? 'Agenda'}</p>
        </div>
        <h2 className="mt-1.5 text-lg font-bold text-[var(--foreground)] capitalize">
          {now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h2>
      </div>

      <div className="px-5 pb-4">
        <div className="rounded-[24px] border border-[var(--shell-line)] bg-[var(--shell-soft)] px-3 py-3">
          <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--shell-muted)]">
            {miniCalendarDays.map((day) => (
              <span key={day} className="py-1">{day}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-y-0.5">
            {monthDays.map((day, index) => {
              const hasAppointments = day ? appointmentPreview.some((item) => item.startTime && sameDay(new Date(now.getFullYear(), now.getMonth(), day), item.startTime)) : false
              const isSelected = day === selectedDay
              const isToday = day === now.getDate()
              return (
                <button
                  key={`${day ?? 'e'}-${index}`}
                  type="button"
                  onClick={() => { if (day) setSelectedDay(day) }}
                  disabled={!day}
                  className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-medium transition-all ${
                    isSelected ? 'bg-brand text-white shadow-sm'
                    : isToday ? 'font-bold text-brand ring-1 ring-brand/30'
                    : hasAppointments ? 'bg-brand/10 text-[var(--foreground)]'
                    : day ? 'text-[var(--shell-muted)] hover:bg-white/80'
                    : 'text-transparent'
                  }`}
                >
                  {day ?? ''}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mx-5 border-t border-[var(--shell-line)]" />

      <div className="px-5 pt-4 pb-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {selectedDay === now.getDate() ? 'Oggi' : `${selectedDay} ${now.toLocaleDateString('it-IT', { month: 'short' })}`}
          </p>
          <span className="rounded-full bg-[var(--shell-canvas)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--shell-muted)]">
            {selectedAppointments.length}
          </span>
        </div>
        {selectedAppointments.length > 0 ? (
          <div className="space-y-2">
            {selectedAppointments.slice(0, 4).map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl bg-[var(--shell-soft)] px-3.5 py-3 transition-colors hover:bg-[var(--shell-canvas)]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-[11px] font-bold text-brand">
                  {item.startTime ? new Date(item.startTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.title}</p>
                  <p className="truncate text-xs text-[var(--shell-muted)]">{item.contactName ?? 'Nessun contatto'}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--shell-line)] bg-[var(--shell-canvas)] px-4 py-5 text-center text-sm text-[var(--shell-muted)]">
            Nessun appuntamento
          </div>
        )}
      </div>
    </WidgetShell>
  )
}
