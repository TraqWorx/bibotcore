'use client'

import React, { useState, useEffect } from 'react'

interface CalEvent {
  id: string
  title?: string
  startTime?: string
  endTime?: string
  appointmentStatus?: string
  contactId?: string
  contactName?: string
  userId?: string
}

interface GhlUser { id: string; name: string }

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 8am–8pm
const DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

function getWeekDates(anchor: Date) {
  const d = new Date(anchor)
  d.setDate(d.getDate() - d.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d)
    day.setDate(d.getDate() + i)
    return day
  })
}

function eventClass(status: string) {
  if (status === 'cancelled') return 'bs-cal-event bs-cal-event-cancelled'
  if (status === 'new' || !status) return 'bs-cal-event bs-cal-event-pending'
  return 'bs-cal-event bs-cal-event-confirmed'
}

function AppointmentPanel({ event, onClose, onAction }: { event: CalEvent; onClose: () => void; onAction: () => void }) {
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  async function setStatus(status: string) {
    setLoading(true); setActionError('')
    const res = await fetch('/api/bellessere/appointments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: event.id, appointmentStatus: status }),
    })
    setLoading(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.message ?? 'Errore aggiornamento'); return }
    onAction()
    onClose()
  }

  const dt = event.startTime ? new Date(event.startTime) : null

  return (
    <>
      <div className="bs-overlay" onClick={onClose} />
      <div className="bs-panel">
        <div className="bs-panel-header">
          <span className="bs-panel-title">Appuntamento</span>
          <button className="bs-panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="bs-panel-body">
          {event.contactName && <div style={{ fontWeight: 700, fontSize: 16 }}>{event.contactName}</div>}
          {event.title && <div style={{ fontSize: 13.5, color: 'var(--bs-text-muted)' }}>{event.title}</div>}
          {dt && (
            <div style={{ fontSize: 13.5 }}>
              {dt.toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        <div className="bs-panel-actions">
          {actionError && <div style={{ padding: '8px 12px', background: '#FEF2F2', color: '#DC2626', borderRadius: 8, fontSize: 12.5 }}>{actionError}</div>}
          {event.appointmentStatus !== 'showed' && (
            <button className="bs-btn-primary" style={{ justifyContent: 'center', width: '100%' }} onClick={() => setStatus('showed')} disabled={loading}>Segna completato</button>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {event.appointmentStatus !== 'cancelled' && (
              <button className="bs-btn-danger" style={{ justifyContent: 'center' }} onClick={() => setStatus('cancelled')} disabled={loading}>Annulla</button>
            )}
            {event.appointmentStatus !== 'noshow' && event.appointmentStatus !== 'cancelled' && (
              <button className="bs-btn-ghost" style={{ justifyContent: 'center' }} onClick={() => setStatus('noshow')} disabled={loading}>No-show</button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default function CalendarioPage() {
  const [anchor, setAnchor] = useState(() => new Date())
  const [events, setEvents] = useState<CalEvent[]>([])
  const [users, setUsers] = useState<GhlUser[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CalEvent | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Load users once
  useEffect(() => {
    fetch('/api/bellessere/services')
      .then(r => r.json())
      .then(d => setUsers((d.users ?? []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))))
      .catch(() => {})
  }, [])

  const weekDates = getWeekDates(anchor)
  const weekStart = weekDates[0]
  const weekEnd = weekDates[6]

  useEffect(() => {
    setLoading(true)
    const start = new Date(weekStart); start.setHours(0, 0, 0, 0)
    const end = new Date(weekEnd); end.setHours(23, 59, 59, 999)
    if (selectedUserIds.length === 0) {
      // Fetch all groups (no filter)
      fetch(`/api/bellessere/appointments?startTime=${start.toISOString()}&endTime=${end.toISOString()}`)
        .then(r => r.json())
        .then(d => setEvents(d.events ?? []))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      // Fetch for each selected user and merge
      Promise.all(
        selectedUserIds.map(uid =>
          fetch(`/api/bellessere/appointments?startTime=${start.toISOString()}&endTime=${end.toISOString()}&userId=${uid}`)
            .then(r => r.json())
            .then(d => d.events ?? [])
            .catch(() => [])
        )
      ).then(results => {
        const seen = new Set<string>()
        const merged = results.flat().filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
        setEvents(merged)
      }).finally(() => setLoading(false))
    }
  }, [weekStart.toISOString(), weekEnd.toISOString(), selectedUserIds.join(','), refreshKey])

  function prevWeek() { const d = new Date(anchor); d.setDate(d.getDate() - 7); setAnchor(d) }
  function nextWeek() { const d = new Date(anchor); d.setDate(d.getDate() + 7); setAnchor(d) }

  const todayStr = new Date().toISOString().slice(0, 10)

  const romeDateFmt = new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Rome' }) // YYYY-MM-DD
  const romeHourFmt = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', hour: 'numeric', hour12: false })

  function eventsForSlot(dayDate: Date, hour: number) {
    const dateStr = romeDateFmt.format(dayDate)
    return events.filter(e => {
      if (!e.startTime) return false
      const d = new Date(e.startTime)
      return romeDateFmt.format(d) === dateStr && parseInt(romeHourFmt.format(d), 10) === hour
    })
  }

  const monthLabel = weekStart.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  const dateRange = `${weekStart.getDate()} – ${weekEnd.getDate()}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="bs-page-eyebrow">Agenda</div>
          <h1 className="bs-page-title">Calendario</h1>
        </div>
        <button className="bs-btn-primary" onClick={() => window.location.href = '/designs/bellessere/appuntamenti'}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuovo appuntamento
        </button>
      </div>

      {/* Calendar nav + user filter */}
      <div className="bs-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="bs-btn-ghost" onClick={prevWeek} style={{ padding: '7px 12px' }}>‹</button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, textTransform: 'capitalize' }}>{monthLabel}</div>
            <div style={{ fontSize: 11.5, color: 'var(--bs-text-faint)' }}>{dateRange}</div>
          </div>
          <button className="bs-btn-ghost" onClick={nextWeek} style={{ padding: '7px 12px' }}>›</button>
          <button className="bs-btn-ghost" onClick={() => setAnchor(new Date())} style={{ fontSize: 12.5 }}>Oggi</button>
        </div>

        {/* User filter — multi-select pills */}
        {users.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedUserIds([])}
              style={{
                padding: '5px 14px', borderRadius: 100, fontSize: 12.5, cursor: 'pointer', transition: 'all 0.15s',
                border: `1.5px solid ${selectedUserIds.length === 0 ? 'var(--bs-black)' : 'var(--bs-line)'}`,
                background: selectedUserIds.length === 0 ? 'var(--bs-black)' : 'white',
                color: selectedUserIds.length === 0 ? 'white' : 'var(--bs-text-muted)',
                fontWeight: selectedUserIds.length === 0 ? 700 : 400,
              }}
            >
              Tutti
            </button>
            {users.map(u => {
              const active = selectedUserIds.includes(u.id)
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserIds(prev =>
                    prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                  )}
                  style={{
                    padding: '5px 14px', borderRadius: 100, fontSize: 12.5, cursor: 'pointer', transition: 'all 0.15s',
                    border: `1.5px solid ${active ? 'var(--bs-gold)' : 'var(--bs-line)'}`,
                    background: active ? 'var(--bs-gold-tint)' : 'white',
                    color: active ? 'var(--bs-gold)' : 'var(--bs-text-muted)',
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {u.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="bs-card" style={{ overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--bs-text-faint)' }}>Caricamento...</div>
        ) : (
          <div className="bs-cal-grid">
            {/* Header */}
            <div className="bs-cal-header-cell" style={{ borderBottom: '1px solid var(--bs-line)' }} />
            {weekDates.map((d, i) => {
              const isToday = d.toISOString().slice(0, 10) === todayStr
              return (
                <div key={i} className={`bs-cal-header-cell ${isToday ? 'today' : ''}`}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: isToday ? 'var(--bs-gold)' : 'var(--bs-text-faint)' }}>{DAYS[i]}</div>
                  <div style={{
                    fontSize: 18, fontWeight: 800, marginTop: 2,
                    width: 32, height: 32, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isToday ? 'var(--bs-black)' : 'transparent',
                    color: isToday ? 'white' : 'var(--bs-text)',
                  }}>
                    {d.getDate()}
                  </div>
                </div>
              )
            })}

            {/* Hour rows */}
            {HOURS.map(hour => (
              <React.Fragment key={hour}>
                <div className="bs-cal-time-cell">{hour}:00</div>
                {weekDates.map((d, di) => {
                  const slotEvents = eventsForSlot(d, hour)
                  return (
                    <div key={di} className="bs-cal-day-cell">
                      {slotEvents.map(ev => (
                        <div
                          key={ev.id}
                          className={eventClass(ev.appointmentStatus ?? 'new')}
                          onClick={() => setSelected(ev)}
                          title={`${ev.contactName ?? ''} · ${ev.title ?? ''}`}
                        >
                          {ev.contactName || ev.title || 'Appuntamento'}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', fontSize: 12.5 }}>
        {[
          { label: 'Confermato', color: 'var(--bs-cta)' },
          { label: 'In attesa', color: 'var(--bs-warning)' },
          { label: 'Annullato', color: 'var(--bs-danger)' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
            <span style={{ color: 'var(--bs-text-muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {selected && (
        <AppointmentPanel
          event={selected}
          onClose={() => setSelected(null)}
          onAction={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  )
}
