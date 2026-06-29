'use client'

import { useState, useEffect, useMemo } from 'react'

interface Appointment {
  id: string
  title?: string
  startTime?: string
  endTime?: string
  appointmentStatus?: string
  contactId?: string
  contactName?: string
  calendarId?: string
}

interface Contact { id: string; firstName: string; lastName: string; email: string; phone: string }
interface Calendar { id: string; name: string; isActive?: boolean }

type StatusFilter = 'all' | 'confirmed' | 'pending' | 'cancelled'

function statusBadge(s: string) {
  const map: Record<string, [string, string]> = {
    confirmed: ['bs-badge-confirmed', 'CONFERMATO'],
    new: ['bs-badge-confirmed', 'CONFERMATO'],
    cancelled: ['bs-badge-cancelled', 'ANNULLATO'],
    showed: ['bs-badge-showed', 'COMPLETATO'],
    'no-show': ['bs-badge-cancelled', 'NO-SHOW'],
  }
  const [cls, label] = map[s] ?? ['bs-badge-pending', 'IN ATTESA']
  return <span className={`bs-badge ${cls}`}>{label}</span>
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?'
}

function AppointmentPanel({
  appt,
  onClose,
  onAction,
}: {
  appt: Appointment
  onClose: () => void
  onAction: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function setStatus(status: string) {
    setLoading(true)
    await fetch('/api/bellessere/appointments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: appt.id, appointmentStatus: status }),
    })
    setLoading(false)
    onAction()
    onClose()
  }

  const dt = appt.startTime ? new Date(appt.startTime) : null
  const dtEnd = appt.endTime ? new Date(appt.endTime) : null

  return (
    <>
      <div className="bs-overlay" onClick={onClose} />
      <div className="bs-panel">
        <div className="bs-panel-header">
          <span className="bs-panel-title">Dettagli appuntamento</span>
          <button className="bs-panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="bs-panel-body">
          {/* Status + ID */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {statusBadge(appt.appointmentStatus ?? 'new')}
            <span style={{ fontSize: 11.5, color: 'var(--bs-text-faint)' }}>ID: {appt.id.slice(0, 8)}</span>
          </div>

          {/* Customer */}
          {appt.contactName && (
            <div className="bs-card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--bs-text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Cliente</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="bs-avatar">{initials(appt.contactName)}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{appt.contactName}</div>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="bs-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--bs-text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Dettagli</div>
            {dt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span style={{ fontSize: 13.5 }}>
                  {dt.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} alle {dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
            {appt.title && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span style={{ fontSize: 13.5 }}>{appt.title}</span>
              </div>
            )}
            {dt && dtEnd && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span style={{ fontSize: 13.5 }}>
                  {Math.round((dtEnd.getTime() - dt.getTime()) / 60000)} min
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="bs-panel-actions">
          {appt.appointmentStatus !== 'showed' && (
            <button className="bs-btn-primary" style={{ justifyContent: 'center' }} onClick={() => setStatus('showed')} disabled={loading}>
              Segna come completato
            </button>
          )}
          {appt.appointmentStatus !== 'confirmed' && appt.appointmentStatus !== 'showed' && (
            <button className="bs-btn-ghost" style={{ justifyContent: 'center' }} onClick={() => setStatus('confirmed')} disabled={loading}>
              Conferma
            </button>
          )}
          {appt.appointmentStatus !== 'cancelled' && (
            <button className="bs-btn-danger" style={{ justifyContent: 'center' }} onClick={() => setStatus('cancelled')} disabled={loading}>
              Annulla appuntamento
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function AddAppointmentModal({
  onClose,
  onAdded,
  contacts,
  calendars,
}: {
  onClose: () => void
  onAdded: () => void
  contacts: Contact[]
  calendars: Calendar[]
}) {
  const [form, setForm] = useState({
    contactId: '',
    calendarId: '',
    startTime: '',
    appointmentStatus: 'confirmed',
    title: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.calendarId || !form.startTime) { setError('Seleziona un servizio e una data'); return }
    setSaving(true)
    setError('')
    try {
      const start = new Date(form.startTime)
      const cal = calendars.find(c => c.id === form.calendarId)
      const end = new Date(start.getTime() + 30 * 60000)
      const res = await fetch('/api/bellessere/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: form.calendarId,
          contactId: form.contactId || undefined,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          appointmentStatus: form.appointmentStatus,
          title: form.title || cal?.name || 'Appuntamento',
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.message ?? d.error ?? 'Errore'); return }
      onAdded()
      onClose()
    } catch { setError('Errore di rete') } finally { setSaving(false) }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="bs-modal-overlay" onClick={onClose}>
      <div className="bs-modal" onClick={ev => ev.stopPropagation()}>
        <div className="bs-modal-header">
          <span className="bs-modal-title">Nuovo appuntamento</span>
          <button className="bs-panel-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="bs-modal-body">
            {error && <div style={{ padding: '10px 12px', background: '#FEF2F2', color: '#DC2626', borderRadius: 8, fontSize: 13 }}>{error}</div>}
            <div>
              <label className="bs-field-label">Servizio (calendario)</label>
              <select className="bs-select" value={form.calendarId} onChange={f('calendarId')} required>
                <option value="">Seleziona servizio...</option>
                {calendars.filter(c => c.isActive !== false).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="bs-field-label">Cliente</label>
              <select className="bs-select" value={form.contactId} onChange={f('contactId')}>
                <option value="">Senza cliente specifico</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{`${c.firstName} ${c.lastName}`.trim() || c.email || c.phone}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="bs-field-label">Data e ora</label>
              <input className="bs-input" type="datetime-local" value={form.startTime} onChange={f('startTime')} required />
            </div>
            <div>
              <label className="bs-field-label">Titolo (opzionale)</label>
              <input className="bs-input" value={form.title} onChange={f('title')} placeholder="Es. Taglio classico" />
            </div>
            <div>
              <label className="bs-field-label">Stato</label>
              <select className="bs-select" value={form.appointmentStatus} onChange={f('appointmentStatus')}>
                <option value="confirmed">Confermato</option>
                <option value="new">In attesa</option>
              </select>
            </div>
          </div>
          <div className="bs-modal-footer">
            <button type="button" className="bs-btn-ghost" onClick={onClose}>Annulla</button>
            <button type="submit" className="bs-btn-primary" disabled={saving}>{saving ? 'Salvataggio...' : 'Crea appuntamento'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function groupByDate(appts: Appointment[]) {
  const groups: Record<string, Appointment[]> = {}
  for (const a of appts) {
    const key = a.startTime ? a.startTime.slice(0, 10) : 'senza data'
    if (!groups[key]) groups[key] = []
    groups[key].push(a)
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
}

function formatDate(d: string) {
  if (d === 'senza data') return 'Senza data'
  return new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function AppuntamentiPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const start = new Date()
    start.setMonth(start.getMonth() - 1)
    const end = new Date()
    end.setMonth(end.getMonth() + 3)

    setLoading(true)
    Promise.all([
      fetch(`/api/bellessere/appointments?startTime=${start.toISOString()}&endTime=${end.toISOString()}`).then(r => r.json()),
      fetch(`/api/contacts?locationId=38lvVkcTVVRFDDcHqYd1&pageSize=200`).then(r => r.json()),
      fetch('/api/bellessere/services').then(r => r.json()),
    ]).then(([evtsData, ctData, svcData]) => {
      const contactMap = new Map((ctData.contacts ?? []).map((c: Contact) => [c.id, `${c.firstName} ${c.lastName}`.trim() || c.email]))
      const appts: Appointment[] = (evtsData.events ?? []).map((e: {
        id: string; title?: string; startTime?: string; endTime?: string;
        appointmentStatus?: string; contactId?: string; calendarId?: string;
      }) => ({
        ...e,
        contactName: e.contactId ? (contactMap.get(e.contactId) ?? null) : null,
      }))
      setAppointments(appts)
      setContacts(ctData.contacts ?? [])
      setCalendars(svcData.calendars ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [refreshKey])

  const filtered = useMemo(() => {
    let list = appointments
    if (filter !== 'all') {
      list = list.filter(a => {
        const s = a.appointmentStatus ?? 'new'
        if (filter === 'confirmed') return s === 'confirmed' || s === 'new'
        if (filter === 'pending') return s === 'pending'
        if (filter === 'cancelled') return s === 'cancelled'
        return true
      })
    }
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(a => (a.contactName ?? '').toLowerCase().includes(s) || (a.title ?? '').toLowerCase().includes(s))
    }
    return list
  }, [appointments, filter, search])

  const totalToday = appointments.filter(a => a.startTime?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length
  const pending = appointments.filter(a => !a.appointmentStatus || a.appointmentStatus === 'new' || a.appointmentStatus === 'pending').length
  const confirmed = appointments.filter(a => a.appointmentStatus === 'confirmed').length
  const cancelled = appointments.filter(a => a.appointmentStatus === 'cancelled').length

  const groups = groupByDate(filtered)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="bs-page-eyebrow">Gestione</div>
          <h1 className="bs-page-title">Appuntamenti</h1>
        </div>
        <button className="bs-btn-primary" onClick={() => setShowAdd(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuovo appuntamento
        </button>
      </div>

      {/* Stats */}
      <div className="bs-stats-grid">
        <div className="bs-stat-card">
          <div className="bs-stat-value">{totalToday}</div>
          <div className="bs-stat-label">Oggi</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-value" style={{ color: 'var(--bs-warning)' }}>{pending}</div>
          <div className="bs-stat-label">In attesa</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-value" style={{ color: 'var(--bs-success)' }}>{confirmed}</div>
          <div className="bs-stat-label">Confermati</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-value" style={{ color: 'var(--bs-danger)' }}>{cancelled}</div>
          <div className="bs-stat-label">Annullati</div>
        </div>
      </div>

      {/* List */}
      <div className="bs-card">
        <div className="bs-filter-bar">
          <div className="bs-search-wrap">
            <svg className="bs-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="bs-search-input"
              placeholder="Cerca per cliente o servizio..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="bs-filter-tabs">
            {(['all', 'confirmed', 'pending', 'cancelled'] as StatusFilter[]).map(s => (
              <button
                key={s}
                className="bs-filter-tab"
                data-active={filter === s ? 'true' : 'false'}
                onClick={() => setFilter(s)}
              >
                {s === 'all' ? 'Tutti' : s === 'confirmed' ? 'Confermati' : s === 'pending' ? 'In attesa' : 'Annullati'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--bs-text-faint)' }}>Caricamento...</div>
        ) : groups.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--bs-text-faint)', fontSize: 13 }}>Nessun appuntamento trovato.</div>
        ) : (
          groups.map(([date, appts]) => (
            <div key={date}>
              <div style={{ padding: '12px 18px', background: 'var(--bs-bg)', borderBottom: '1px solid var(--bs-line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{formatDate(date)}</span>
                <span style={{ fontSize: 12, color: 'var(--bs-text-faint)' }}>{appts.length} appuntamenti</span>
              </div>
              {appts.map(a => {
                const time = a.startTime ? new Date(a.startTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—'
                const name = a.contactName || '—'
                return (
                  <div key={a.id} className="bs-list-row" onClick={() => setSelected(a)}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bs-text-muted)', width: 52, flexShrink: 0 }}>{time}</div>
                    <div className="bs-avatar">{initials(name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{name}</div>
                      <div style={{ fontSize: 12, color: 'var(--bs-text-muted)' }}>{a.title || 'Appuntamento'}</div>
                    </div>
                    {statusBadge(a.appointmentStatus ?? 'new')}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--bs-text-faint)" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      {selected && (
        <AppointmentPanel
          appt={selected}
          onClose={() => setSelected(null)}
          onAction={() => setRefreshKey(k => k + 1)}
        />
      )}
      {showAdd && (
        <AddAppointmentModal
          onClose={() => setShowAdd(false)}
          onAdded={() => setRefreshKey(k => k + 1)}
          contacts={contacts}
          calendars={calendars}
        />
      )}
    </div>
  )
}
