'use client'

import { useState, useEffect, useMemo } from 'react'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

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
interface Calendar { id: string; name: string; slotDuration?: number; price?: number; isActive?: boolean }

type StatusFilter = 'all' | 'confirmed' | 'pending' | 'cancelled'

const STATUS_CFG: Record<string, { cls: string; label: string }> = {
  confirmed:  { cls: 'bs-badge-confirmed', label: 'CONFERMATO' },
  new:        { cls: 'bs-badge-confirmed', label: 'CONFERMATO' },
  cancelled:  { cls: 'bs-badge-cancelled', label: 'ANNULLATO' },
  showed:     { cls: 'bs-badge-showed',    label: 'COMPLETATO' },
  noshow:     { cls: 'bs-badge-cancelled', label: 'NO-SHOW' },
  'no-show':  { cls: 'bs-badge-cancelled', label: 'NO-SHOW' },
  pending:    { cls: 'bs-badge-pending',   label: 'IN ATTESA' },
}

function Badge({ s }: { s: string }) {
  const { cls, label } = STATUS_CFG[s] ?? { cls: 'bs-badge-pending', label: 'IN ATTESA' }
  return <span className={`bs-badge ${cls}`}>{label}</span>
}

function initials(name: string) {
  return name.split(' ').map(p => p[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}

function AppointmentPanel({
  appt, calendars, onClose, onAction,
}: {
  appt: Appointment; calendars: Calendar[]; onClose: () => void; onAction: () => void
}) {
  const [loading, setLoading] = useState(false)
  const calendar = calendars.find(c => c.id === appt.calendarId)
  const dt = appt.startTime ? new Date(appt.startTime) : null
  const dtEnd = appt.endTime ? new Date(appt.endTime) : null
  const duration = dt && dtEnd ? Math.round((dtEnd.getTime() - dt.getTime()) / 60000) : calendar?.slotDuration ?? null

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

  return (
    <>
      <div className="bs-overlay" onClick={onClose} />
      <div className="bs-panel">
        <div className="bs-panel-header">
          <span className="bs-panel-title">Dettagli appuntamento</span>
          <button className="bs-panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="bs-panel-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge s={appt.appointmentStatus ?? 'new'} />
            <span style={{ fontSize: 11, color: 'var(--bs-text-faint)' }}>ID: #{appt.id.slice(-6).toUpperCase()}</span>
          </div>

          {appt.contactName && (
            <div className="bs-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--bs-text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Cliente</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="bs-avatar" style={{ width: 42, height: 42, fontSize: 14 }}>{initials(appt.contactName)}</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{appt.contactName}</div>
              </div>
            </div>
          )}

          <div className="bs-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--bs-text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Dettagli</div>
            {dt && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bs-gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--bs-text-faint)', marginBottom: 2 }}>Data e ora</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, textTransform: 'capitalize' }}>
                    {dt.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} alle {dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )}
            {(appt.title || calendar?.name) && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bs-gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--bs-text-faint)', marginBottom: 2 }}>Servizio</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{appt.title || calendar?.name || 'Appuntamento'}</div>
                </div>
              </div>
            )}
            {(duration || calendar?.price) && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bs-gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--bs-text-faint)', marginBottom: 2 }}>Durata e prezzo</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                    {duration ? `${duration} min` : '—'}{calendar?.price ? ` · €${calendar.price}` : ''}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bs-panel-actions">
          {appt.appointmentStatus !== 'showed' && (
            <button
              className="bs-btn-primary"
              style={{ justifyContent: 'center', width: '100%' }}
              onClick={() => setStatus('showed')}
              disabled={loading}
            >
              Segna come completato
            </button>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {appt.appointmentStatus !== 'confirmed' && appt.appointmentStatus !== 'showed' && (
              <button className="bs-btn-ghost" style={{ justifyContent: 'center' }} onClick={() => setStatus('confirmed')} disabled={loading}>
                Conferma
              </button>
            )}
            {appt.appointmentStatus !== 'cancelled' && (
              <button className="bs-btn-danger" style={{ justifyContent: 'center' }} onClick={() => setStatus('cancelled')} disabled={loading}>
                Annulla
              </button>
            )}
            {appt.appointmentStatus !== 'noshow' && appt.appointmentStatus !== 'cancelled' && (
              <button className="bs-btn-ghost" style={{ justifyContent: 'center', gridColumn: appt.appointmentStatus === 'confirmed' ? 'span 2' : 'auto' }} onClick={() => setStatus('noshow')} disabled={loading}>
                No-show
              </button>
            )}
          </div>
          <button className="bs-btn-ghost" style={{ justifyContent: 'center', width: '100%' }} onClick={onClose}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Invia promemoria
          </button>
        </div>
      </div>
    </>
  )
}

function AddAppointmentModal({ onClose, onAdded, contacts, calendars }: {
  onClose: () => void; onAdded: () => void; contacts: Contact[]; calendars: Calendar[]
}) {
  const [form, setForm] = useState({ contactId: '', calendarId: '', startTime: '', appointmentStatus: 'confirmed', title: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.calendarId || !form.startTime) { setError('Seleziona un servizio e una data'); return }
    setSaving(true); setError('')
    try {
      const start = new Date(form.startTime)
      const cal = calendars.find(c => c.id === form.calendarId)
      const end = new Date(start.getTime() + (cal?.slotDuration ?? 30) * 60000)
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
      onAdded(); onClose()
    } catch { setError('Errore di rete') } finally { setSaving(false) }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="bs-modal-overlay" onClick={onClose}>
      <div className="bs-modal" onClick={ev => ev.stopPropagation()}>
        <div className="bs-modal-header">
          <span className="bs-modal-title">Nuovo appuntamento</span>
          <button className="bs-panel-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="bs-modal-body">
            {error && <div style={{ padding: '10px 14px', background: '#FEF2F2', color: '#DC2626', borderRadius: 9, fontSize: 13 }}>{error}</div>}
            <div>
              <label className="bs-field-label">Servizio *</label>
              <select className="bs-select" value={form.calendarId} onChange={f('calendarId')} required>
                <option value="">Seleziona servizio...</option>
                {calendars.filter(c => c.isActive !== false).map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.price ? ` — €${c.price}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="bs-field-label">Cliente</label>
              <select className="bs-select" value={form.contactId} onChange={f('contactId')}>
                <option value="">Senza cliente</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{`${c.firstName} ${c.lastName}`.trim() || c.email || c.phone}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="bs-field-label">Data e ora *</label>
              <input className="bs-input" type="datetime-local" value={form.startTime} onChange={f('startTime')} required />
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
    const key = a.startTime ? a.startTime.slice(0, 10) : 'z'
    if (!groups[key]) groups[key] = []
    groups[key].push(a)
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
}

function formatGroupDate(d: string) {
  if (d === 'z') return 'Senza data'
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
    const start = new Date(); start.setMonth(start.getMonth() - 1)
    const end = new Date(); end.setMonth(end.getMonth() + 3)
    setLoading(true)
    Promise.all([
      fetch(`/api/bellessere/appointments?startTime=${start.toISOString()}&endTime=${end.toISOString()}`).then(r => r.json()),
      fetch(`/api/contacts?locationId=${BELLESSERE_LOCATION_ID}&pageSize=200`).then(r => r.json()),
      fetch('/api/bellessere/services').then(r => r.json()),
    ]).then(([evtsData, ctData, svcData]) => {
      const contactMap = new Map((ctData.contacts ?? []).map((c: Contact) => [c.id, `${c.firstName} ${c.lastName}`.trim() || c.email]))
      const appts: Appointment[] = (evtsData.events ?? []).map((e: Omit<Appointment, 'contactName'>) => ({
        ...e,
        contactName: e.contactId ? (contactMap.get(e.contactId) ?? undefined) : undefined,
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
      const q = search.toLowerCase()
      list = list.filter(a => (a.contactName ?? '').toLowerCase().includes(q) || (a.title ?? '').toLowerCase().includes(q))
    }
    return list
  }, [appointments, filter, search])

  const todayStr = new Date().toISOString().slice(0, 10)
  const totalToday = appointments.filter(a => a.startTime?.slice(0, 10) === todayStr).length
  const pending = appointments.filter(a => a.appointmentStatus === 'pending' || (!a.appointmentStatus)).length
  const confirmed = appointments.filter(a => a.appointmentStatus === 'confirmed' || a.appointmentStatus === 'new').length
  const cancelled = appointments.filter(a => a.appointmentStatus === 'cancelled').length

  const groups = groupByDate(filtered)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="bs-page-eyebrow">Gestione</div>
          <h1 className="bs-page-title">Appuntamenti</h1>
        </div>
        <button className="bs-btn-primary" onClick={() => setShowAdd(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuovo appuntamento
        </button>
      </div>

      {/* Stat cards — clean, no icons */}
      <div className="bs-stats-grid">
        {[
          { value: totalToday, label: 'Oggi', color: 'var(--bs-text)' },
          { value: pending, label: 'In attesa', color: 'var(--bs-warning)' },
          { value: confirmed, label: 'Confermati', color: 'var(--bs-text)' },
          { value: cancelled, label: 'Annullati', color: 'var(--bs-danger)' },
        ].map(s => (
          <div key={s.label} className="bs-stat-card">
            <div className="bs-stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="bs-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
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
              <button key={s} className="bs-filter-tab" data-active={filter === s ? 'true' : 'false'} onClick={() => setFilter(s)}>
                {s === 'all' ? 'Tutti' : s === 'confirmed' ? 'Confermati' : s === 'pending' ? 'In attesa' : 'Annullati'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Appointment list */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--bs-text-faint)' }}>Caricamento...</div>
      ) : groups.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--bs-text-faint)', fontSize: 13 }}>Nessun appuntamento trovato.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {groups.map(([date, appts]) => (
            <div key={date} className="bs-date-group">
              <div className="bs-date-header">
                <div className="bs-date-dot">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2.5">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, textTransform: 'capitalize' }}>{formatGroupDate(date)}</div>
                  <div style={{ fontSize: 12, color: 'var(--bs-text-muted)' }}>{appts.length} appuntament{appts.length === 1 ? 'o' : 'i'}</div>
                </div>
              </div>

              {appts.map(a => {
                const time = a.startTime ? new Date(a.startTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—'
                const name = a.contactName || 'Cliente'
                const cal = calendars.find(c => c.id === a.calendarId)
                return (
                  <div key={a.id} className="bs-appt-row" onClick={() => setSelected(a)}>
                    <div className="bs-appt-time">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--bs-text-faint)" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {time}
                    </div>
                    <div className="bs-avatar">{initials(name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{name}</div>
                      <div style={{ fontSize: 12, color: 'var(--bs-text-muted)' }}>{a.title || cal?.name || 'Appuntamento'}</div>
                    </div>
                    {cal?.price && (
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--bs-text)', flexShrink: 0 }}>€{cal.price}</div>
                    )}
                    <Badge s={a.appointmentStatus ?? 'new'} />
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--bs-text-faint)" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <AppointmentPanel
          appt={selected}
          calendars={calendars}
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
