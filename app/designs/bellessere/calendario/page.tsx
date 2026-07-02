'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface CalEvent {
  id: string
  title?: string
  startTime?: string
  endTime?: string
  appointmentStatus?: string
  contactId?: string
  contactName?: string
  userId?: string
  calendarId?: string
}

interface GhlUser { id: string; name: string }
interface GhlCalendar { id: string; name: string; slotDuration?: number; isActive?: boolean; price?: number; teamMembers?: { userId: string }[] }

type ViewMode = 'week' | 'day'

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 8–20
const DAYS_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

// Per-user border colors (assigned by stable index)
const USER_COLORS = ['#C9A84C', '#6366F1', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6', '#06B6D4', '#EC4899', '#14B8A6', '#F97316']

// Status background + text color
function statusStyle(s?: string): { background: string; color: string } {
  const status = s ?? 'new'
  if (status === 'cancelled') return { background: 'rgba(239,68,68,0.12)', color: '#B91C1C' }
  if (status === 'no-show' || status === 'noshow') return { background: 'rgba(107,114,128,0.12)', color: '#374151' }
  if (status === 'showed') return { background: 'rgba(99,102,241,0.14)', color: '#4338CA' }
  if (status === 'pending') return { background: 'rgba(245,158,11,0.13)', color: '#92400E' }
  return { background: 'rgba(16,185,129,0.12)', color: '#065F46' } // confirmed/new
}

function initials(name: string) {
  return name.split(' ').map(p => p[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}

interface Contact { id: string; firstName: string; lastName: string; email: string; phone: string }

function ContactCombobox({ contacts, value, onChange }: { contacts: Contact[]; value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = contacts.find(c => c.id === value)
  const displayName = (c: Contact) => `${c.firstName} ${c.lastName}`.trim() || c.email
  const results = query.length < 1 ? contacts.slice(0, 40) : contacts.filter(c => displayName(c).toLowerCase().includes(query.toLowerCase()) || c.phone?.includes(query)).slice(0, 40)
  const pick = (id: string) => { onChange(id); setOpen(false); setQuery('') }
  return (
    <div style={{ position: 'relative' }}>
      <input className="bs-input" placeholder="Cerca cliente..." autoComplete="off"
        value={open ? query : (selected ? displayName(selected) : '')}
        onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="bs-combo-popover">
          <div onMouseDown={() => pick('')} className="bs-combo-option" style={{ color: 'var(--bs-text-muted)' }}>Senza cliente</div>
          {results.length === 0
            ? <div className="bs-combo-option" style={{ color: 'var(--bs-text-faint)', cursor: 'default' }}>Nessun risultato</div>
            : results.map(c => (
              <div key={c.id} onMouseDown={() => pick(c.id)} className="bs-combo-option" style={{ fontWeight: c.id === value ? 750 : 500 }}>
                <span>{displayName(c)}</span>
                {c.phone && <span style={{ fontSize: 11, color: 'var(--bs-text-faint)' }}>{c.phone}</span>}
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

function AddAppointmentModal({ contacts, calendars, users, onClose, onAdded }: {
  contacts: Contact[]; calendars: GhlCalendar[]; users: GhlUser[]
  onClose: () => void; onAdded: () => void
}) {
  const [form, setForm] = useState({ contactId: '', calendarId: '', userId: '', date: '', slot: '', appointmentStatus: 'confirmed' })
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selectedCal = calendars.find(c => c.id === form.calendarId)
  const calTeamIds = new Set((selectedCal?.teamMembers ?? []).map(m => m.userId))
  const calUsers = users.filter(u => calTeamIds.has(u.id))
  useEffect(() => { setForm(p => ({ ...p, userId: '', slot: '' })) }, [form.calendarId])
  useEffect(() => {
    if (!form.calendarId || !form.date) { setSlots([]); return }
    setLoadingSlots(true); setForm(p => ({ ...p, slot: '' }))
    const params = new URLSearchParams({ calendarId: form.calendarId, date: form.date })
    if (form.userId) params.set('userId', form.userId)
    fetch(`/api/bellessere/free-slots?${params}`).then(r => r.json()).then(d => setSlots(d.slots ?? [])).catch(() => setSlots([])).finally(() => setLoadingSlots(false))
  }, [form.calendarId, form.date, form.userId])
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.calendarId || !form.date || !form.slot) { setError('Seleziona servizio, data e orario'); return }
    setSaving(true); setError('')
    try {
      const cal = calendars.find(c => c.id === form.calendarId)
      const tzParts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', timeZoneName: 'longOffset' }).formatToParts(new Date(`${form.date}T12:00:00Z`))
      const offsetStr = (tzParts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+02:00').replace('GMT', '')
      const start = new Date(`${form.date}T${form.slot}:00${offsetStr}`)
      const end = new Date(start.getTime() + (cal?.slotDuration ?? 30) * 60000)
      const res = await fetch('/api/bellessere/appointments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId: form.calendarId, contactId: form.contactId || undefined, userId: form.userId || undefined, startTime: start.toISOString(), endTime: end.toISOString(), appointmentStatus: form.appointmentStatus, title: cal?.name ?? 'Appuntamento', selectedTimezone: 'Europe/Rome' }),
      })
      const data = await res.json().catch(() => ({})) as { message?: string; error?: string }
      if (!res.ok) { setError(data.message ?? data.error ?? 'Errore'); return }
      setTimeout(onAdded, 1200); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Errore di rete') } finally { setSaving(false) }
  }
  const today = new Date().toISOString().slice(0, 10)
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
              <select className="bs-select" value={form.calendarId} onChange={e => setForm(p => ({ ...p, calendarId: e.target.value }))} required>
                <option value="">Seleziona servizio...</option>
                {calendars.filter(c => c.isActive !== false).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {calUsers.length > 0 && (
              <div>
                <label className="bs-field-label">Professionista</label>
                <select className="bs-select" value={form.userId} onChange={e => setForm(p => ({ ...p, userId: e.target.value, slot: '' }))}>
                  <option value="">Qualsiasi disponibile</option>
                  {calUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="bs-field-label">Cliente</label>
              <ContactCombobox contacts={contacts} value={form.contactId} onChange={id => setForm(p => ({ ...p, contactId: id }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="bs-field-label">Data *</label>
                <input className="bs-input" type="date" min={today} value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value, slot: '' }))} required />
              </div>
              <div>
                <label className="bs-field-label">Orario *</label>
                {loadingSlots
                  ? <div className="bs-input" style={{ color: 'var(--bs-text-faint)', fontSize: 13 }}>Caricamento...</div>
                  : <select className="bs-select" value={form.slot} onChange={e => setForm(p => ({ ...p, slot: e.target.value }))} required disabled={!form.calendarId || !form.date}>
                      <option value="">{!form.calendarId || !form.date ? '— prima scegli data —' : slots.length === 0 ? 'Nessuno slot' : 'Scegli orario...'}</option>
                      {slots.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                }
              </div>
            </div>
            <div>
              <label className="bs-field-label">Stato</label>
              <select className="bs-select" value={form.appointmentStatus} onChange={e => setForm(p => ({ ...p, appointmentStatus: e.target.value }))}>
                <option value="confirmed">Confermato</option>
              </select>
            </div>
          </div>
          <div className="bs-modal-footer">
            <button type="button" className="bs-btn-ghost" onClick={onClose}>Annulla</button>
            <button type="submit" className="bs-btn-primary" disabled={saving || !form.slot}>{saving ? 'Salvataggio...' : 'Crea appuntamento'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Reschedule mini-modal ─────────────────────────────────────────────────
function RescheduleModal({ event, calendars, users, onClose, onDone }: {
  event: CalEvent; calendars: GhlCalendar[]; users: GhlUser[]
  onClose: () => void; onDone: () => void
}) {
  const cal = calendars.find(c => c.id === event.calendarId)
  const calTeamIds = new Set((cal?.teamMembers ?? []).map(m => m.userId))
  const calUsers = users.filter(u => calTeamIds.has(u.id))

  const [userId, setUserId] = useState(event.userId ?? '')
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!event.calendarId || !date) { setSlots([]); return }
    setLoadingSlots(true); setSlot('')
    const params = new URLSearchParams({ calendarId: event.calendarId, date })
    if (userId) params.set('userId', userId)
    fetch(`/api/bellessere/free-slots?${params}`)
      .then(r => r.json()).then(d => setSlots(d.slots ?? [])).catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false))
  }, [event.calendarId, date, userId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !slot) { setError('Scegli data e orario'); return }
    setSaving(true); setError('')
    try {
      const tzParts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', timeZoneName: 'longOffset' })
        .formatToParts(new Date(`${date}T12:00:00Z`))
      const offsetStr = (tzParts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+02:00').replace('GMT', '')
      const start = new Date(`${date}T${slot}:00${offsetStr}`)
      const end = new Date(start.getTime() + (cal?.slotDuration ?? 30) * 60000)
      const res = await fetch('/api/bellessere/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, startTime: start.toISOString(), endTime: end.toISOString() }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string; message?: string }
      if (!res.ok) { setError(data.message ?? data.error ?? 'Errore'); return }
      onDone(); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Errore') } finally { setSaving(false) }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="bs-modal-overlay" style={{ zIndex: 310 }} onClick={onClose}>
      <div className="bs-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="bs-modal-header">
          <span className="bs-modal-title">Rischedula appuntamento</span>
          <button className="bs-panel-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="bs-modal-body">
            {error && <div style={{ padding: '10px 14px', background: '#FEF2F2', color: '#DC2626', borderRadius: 9, fontSize: 13 }}>{error}</div>}
            <div style={{ padding: '10px 14px', background: 'var(--bs-bg)', borderRadius: 9, fontSize: 13, color: 'var(--bs-text-muted)' }}>
              Servizio: <strong style={{ color: 'var(--bs-text)' }}>{cal?.name ?? event.title ?? 'Appuntamento'}</strong>
            </div>
            {calUsers.length > 0 && (
              <div>
                <label className="bs-field-label">Professionista</label>
                <select className="bs-select" value={userId} onChange={e => setUserId(e.target.value)}>
                  <option value="">Qualsiasi</option>
                  {calUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="bs-field-label">Data *</label>
                <input className="bs-input" type="date" min={today} value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div>
                <label className="bs-field-label">Orario *</label>
                {loadingSlots
                  ? <div className="bs-input" style={{ color: 'var(--bs-text-faint)', fontSize: 13 }}>Caricamento...</div>
                  : <select className="bs-select" value={slot} onChange={e => setSlot(e.target.value)} required disabled={!date}>
                      <option value="">{!date ? '— prima la data —' : slots.length === 0 ? 'Nessuno slot' : 'Scegli...'}</option>
                      {slots.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                }
              </div>
            </div>
          </div>
          <div className="bs-modal-footer">
            <button type="button" className="bs-btn-ghost" onClick={onClose}>Annulla</button>
            <button type="submit" className="bs-btn-primary" disabled={saving || !slot}>{saving ? 'Salvataggio...' : 'Conferma'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Appointment popup modal ───────────────────────────────────────────────
function AppointmentModal({ event, users, calendars, onClose, onAction }: {
  event: CalEvent; users: GhlUser[]; calendars: GhlCalendar[]
  onClose: () => void; onAction: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [showReschedule, setShowReschedule] = useState(false)

  const dt = event.startTime ? new Date(event.startTime) : null
  const operator = users.find(u => u.id === event.userId)
  const calendar = calendars.find(c => c.id === event.calendarId)
  const st = event.appointmentStatus ?? 'new'
  const { background, color } = statusStyle(st)

  const STATUS_LABEL: Record<string, string> = {
    confirmed: 'Confermato', new: 'In attesa', cancelled: 'Cancellato',
    showed: 'Completato', 'no-show': 'No-show', noshow: 'No-show', pending: 'In attesa',
  }

  async function setStatus(status: string) {
    setLoading(true); setActionError('')
    const res = await fetch('/api/bellessere/appointments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: event.id, appointmentStatus: status }),
    })
    const data = await res.json().catch(() => ({})) as { message?: string; error?: string }
    setLoading(false)
    if (!res.ok) { setActionError(data.message ?? data.error ?? 'Errore'); return }
    onAction(); onClose()
  }

  return (
    <>
      <div className="bs-modal-overlay" style={{ zIndex: 300 }} onClick={onClose}>
        <div className="bs-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
          <div className="bs-modal-header" style={{ borderBottom: '1px solid var(--bs-line)' }}>
            <span className="bs-modal-title">Dettagli appuntamento</span>
            <button className="bs-panel-close" onClick={onClose}>✕</button>
          </div>

          <div className="bs-modal-body">
            {/* Client + status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="bs-avatar" style={{ width: 48, height: 48, fontSize: 16, flexShrink: 0 }}>
                {initials(event.contactName ?? event.title ?? '?')}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{event.contactName ?? 'Cliente'}</div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 100, fontSize: 12, fontWeight: 700, background, color }}>
                    {STATUS_LABEL[st] ?? st}
                  </span>
                </div>
              </div>
            </div>

            {/* Details rows */}
            <div className="bs-card" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {dt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--bs-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bs-text-muted)" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
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
              {(event.title || calendar?.name) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--bs-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bs-text-muted)" strokeWidth="2">
                      <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5V5c0-.83.67-1.5 1.5-1.5"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--bs-text-faint)', marginBottom: 2 }}>Servizio</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{event.title || calendar?.name}</div>
                  </div>
                </div>
              )}
              {operator && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--bs-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bs-text-muted)" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--bs-text-faint)', marginBottom: 2 }}>Operatore</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{operator.name}</div>
                  </div>
                </div>
              )}
            </div>

            {actionError && <div style={{ padding: '8px 12px', background: '#FEF2F2', color: '#DC2626', borderRadius: 8, fontSize: 12.5 }}>{actionError}</div>}
          </div>

          <div className="bs-modal-footer" style={{ flexDirection: 'column', gap: 8 }}>
            {st !== 'showed' && (
              <button className="bs-btn-primary" style={{ justifyContent: 'center', width: '100%' }} onClick={() => setStatus('showed')} disabled={loading}>
                Segna come completato
              </button>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
              <button className="bs-btn-ghost" style={{ justifyContent: 'center' }} onClick={() => setShowReschedule(true)} disabled={loading}>
                Rischedula
              </button>
              {st !== 'cancelled' && (
                <button className="bs-btn-danger" style={{ justifyContent: 'center' }} onClick={() => setStatus('cancelled')} disabled={loading}>
                  Cancella
                </button>
              )}
              {st !== 'confirmed' && st !== 'showed' && (
                <button className="bs-btn-ghost" style={{ justifyContent: 'center' }} onClick={() => setStatus('confirmed')} disabled={loading}>
                  Conferma
                </button>
              )}
              {st !== 'no-show' && st !== 'noshow' && st !== 'cancelled' && (
                <button className="bs-btn-ghost" style={{ justifyContent: 'center' }} onClick={() => setStatus('no-show')} disabled={loading}>
                  No-show
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {showReschedule && (
        <RescheduleModal
          event={event}
          calendars={calendars}
          users={users}
          onClose={() => setShowReschedule(false)}
          onDone={() => { onAction(); onClose() }}
        />
      )}
    </>
  )
}

// ── Week helpers ──────────────────────────────────────────────────────────
function getWeekDates(anchor: Date) {
  const d = new Date(anchor)
  d.setDate(d.getDate() - d.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d); day.setDate(d.getDate() + i); return day
  })
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function CalendarioPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [events, setEvents] = useState<CalEvent[]>([])
  const [users, setUsers] = useState<GhlUser[]>([])
  const [contacts, setContacts] = useState<{ id: string; firstName: string; lastName: string; email: string; phone: string }[]>([])
  const [calendars, setCalendars] = useState<GhlCalendar[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CalEvent | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Build stable user→color map
  const userColorMap = Object.fromEntries(users.map((u, i) => [u.id, USER_COLORS[i % USER_COLORS.length]]))

  useEffect(() => {
    fetch('/api/bellessere/services')
      .then(r => r.json())
      .then(d => {
        setUsers((d.users ?? []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })))
        setCalendars(d.calendars ?? [])
      })
      .catch(() => {})
    fetch('/api/bellessere/contacts')
      .then(r => r.json())
      .then(d => setContacts(d.contacts ?? []))
      .catch(() => {})
    // (appointments cache is refreshed once per session by the Sidebar)
  }, [])

  const weekDates = getWeekDates(anchor)

  // Compute visible date range based on view mode
  const { rangeStart, rangeEnd } = (() => {
    if (viewMode === 'day') {
      const s = new Date(anchor); s.setHours(0, 0, 0, 0)
      const e = new Date(anchor); e.setHours(23, 59, 59, 999)
      return { rangeStart: s, rangeEnd: e }
    }
    const s = new Date(weekDates[0]); s.setHours(0, 0, 0, 0)
    const e = new Date(weekDates[6]); e.setHours(23, 59, 59, 999)
    return { rangeStart: s, rangeEnd: e }
  })()

  const fetchEvents = useCallback((start: Date, end: Date) => {
    return fetch(`/api/bellessere/appointments?startTime=${start.toISOString()}&endTime=${end.toISOString()}`)
      .then(r => r.json()).then(d => setEvents(d.events ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchEvents(rangeStart, rangeEnd).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart.toISOString(), rangeEnd.toISOString(), refreshKey, fetchEvents])

  useEffect(() => {
    const channel = supabase
      .channel('bellessere-calendario')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cached_calendar_events', filter: `location_id=eq.${BELLESSERE_LOCATION_ID}` },
        () => { fetchEvents(rangeStart, rangeEnd) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart.toISOString(), rangeEnd.toISOString(), fetchEvents])

  // Client-side operator filter. Events now carry the operator in userId
  // (normalised from GHL's assignedUserId server-side).
  const displayedEvents = selectedUserIds.length === 0
    ? events
    : events.filter(e => e.userId != null && selectedUserIds.includes(e.userId))

  function prevPeriod() {
    const d = new Date(anchor)
    if (viewMode === 'day') d.setDate(d.getDate() - 1)
    else d.setDate(d.getDate() - 7)
    setAnchor(d)
  }
  function nextPeriod() {
    const d = new Date(anchor)
    if (viewMode === 'day') d.setDate(d.getDate() + 1)
    else d.setDate(d.getDate() + 7)
    setAnchor(d)
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const romeFmt = new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Rome' })
  const romeHourFmt = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', hour: 'numeric', hour12: false })

  function eventsForSlot(dayDate: Date, hour: number) {
    const dateStr = romeFmt.format(dayDate)
    return displayedEvents.filter(e => {
      if (!e.startTime) return false
      const d = new Date(e.startTime)
      return romeFmt.format(d) === dateStr && parseInt(romeHourFmt.format(d), 10) === hour
    })
  }

  // Heading label
  const navLabel = viewMode === 'day'
    ? anchor.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : `${weekDates[0].getDate()} – ${weekDates[6].getDate()} ${weekDates[0].toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}`

  const displayDates = viewMode === 'week' ? weekDates : [anchor]

  return (
    <div className="bs-page-stack">
      <div className="bs-page-header">
        <div className="bs-page-header-start">
          <div className="bs-page-eyebrow">Agenda</div>
          <h1 className="bs-page-title">Calendario</h1>
          <div className="bs-page-subtitle">Vista settimanale o giornaliera con filtri operatore e dettagli appuntamento.</div>
        </div>
        <div className="bs-page-actions">
          <button className="bs-btn-primary" onClick={() => setShowAdd(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nuovo appuntamento
          </button>
        </div>
      </div>

      {/* Controls bar */}
      <div className="bs-card" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Row 1: view toggle + navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'var(--bs-bg)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--bs-line)', flexShrink: 0 }}>
            {(['week', 'day'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setViewMode(v)} style={{
                padding: '7px 16px', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: viewMode === v ? 700 : 500,
                background: viewMode === v ? 'var(--bs-black)' : 'transparent',
                color: viewMode === v ? 'white' : 'var(--bs-text-muted)',
                transition: 'all 0.15s',
              }}>
                {v === 'week' ? 'Settimana' : 'Giorno'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button className="bs-btn-ghost" onClick={prevPeriod} style={{ padding: '7px 12px' }}>‹</button>
            <div style={{ fontWeight: 700, fontSize: 14.5, textTransform: 'capitalize', minWidth: 160 }}>{navLabel}</div>
            <button className="bs-btn-ghost" onClick={nextPeriod} style={{ padding: '7px 12px' }}>›</button>
            <button className="bs-btn-ghost" onClick={() => setAnchor(new Date())} style={{ fontSize: 12.5 }}>Oggi</button>
          </div>
          {/* Status legend inline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {[
              { label: 'Confermato', bg: 'rgba(16,185,129,0.14)', border: '#10B981' },
              { label: 'Completato', bg: 'rgba(99,102,241,0.14)', border: '#6366F1' },
              { label: 'Cancellato', bg: 'rgba(239,68,68,0.14)', border: '#EF4444' },
              { label: 'No-show', bg: 'rgba(107,114,128,0.14)', border: '#6B7280' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 9, borderRadius: 2, background: l.bg, borderLeft: `3px solid ${l.border}`, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--bs-text-muted)', whiteSpace: 'nowrap' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Row 2: user filter pills (only when users exist) */}
        {users.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 4, borderTop: '1px solid var(--bs-line)' }}>
            <span style={{ fontSize: 11.5, color: 'var(--bs-text-faint)', marginRight: 4, flexShrink: 0 }}>Operatore:</span>
            <button
              onClick={() => setSelectedUserIds([])}
              style={{
                padding: '4px 12px', borderRadius: 100, fontSize: 12, cursor: 'pointer',
                border: `1.5px solid ${selectedUserIds.length === 0 ? 'var(--bs-black)' : 'var(--bs-line)'}`,
                background: selectedUserIds.length === 0 ? 'var(--bs-black)' : 'transparent',
                color: selectedUserIds.length === 0 ? 'white' : 'var(--bs-text-muted)',
                fontWeight: selectedUserIds.length === 0 ? 700 : 400,
              }}
            >Tutti</button>
            {users.map((u, idx) => {
              const active = selectedUserIds.includes(u.id)
              const col = USER_COLORS[idx % USER_COLORS.length]
              return (
                <button key={u.id}
                  onClick={() => setSelectedUserIds(prev =>
                    prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                  )}
                  style={{
                    padding: '4px 12px', borderRadius: 100, fontSize: 12, cursor: 'pointer',
                    border: `1.5px solid ${active ? col : 'var(--bs-line)'}`,
                    background: active ? col + '20' : 'transparent',
                    color: active ? col : 'var(--bs-text-muted)',
                    fontWeight: active ? 700 : 400,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: col, flexShrink: 0 }} />
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
          <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${displayDates.length}, 1fr)`, minWidth: displayDates.length > 1 ? 700 : 400 }}>
            {/* Header */}
            <div style={{ borderBottom: '1px solid var(--bs-line)', borderRight: '1px solid var(--bs-line)' }} />
            {displayDates.map((d, i) => {
              const iso = d.toISOString().slice(0, 10)
              const isToday = iso === todayStr
              return (
                <div key={i} style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid var(--bs-line)', borderRight: i < displayDates.length - 1 ? '1px solid var(--bs-line)' : 'none' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: isToday ? 'var(--bs-gold)' : 'var(--bs-text-faint)' }}>
                    {viewMode === 'week' ? DAYS_IT[d.getDay()] : d.toLocaleDateString('it-IT', { weekday: 'long' })}
                  </div>
                  <div style={{
                    fontSize: 18, fontWeight: 800, marginTop: 2,
                    width: 32, height: 32, borderRadius: '50%', margin: '2px auto 0',
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
                <div style={{ padding: '4px 8px', fontSize: 11.5, color: 'var(--bs-text-faint)', textAlign: 'right', borderBottom: '1px solid var(--bs-line)', borderRight: '1px solid var(--bs-line)', whiteSpace: 'nowrap' }}>
                  {hour}:00
                </div>
                {displayDates.map((d, di) => {
                  const slotEvents = eventsForSlot(d, hour)
                  return (
                    <div key={di} style={{ minHeight: 52, padding: 3, borderBottom: '1px solid var(--bs-line)', borderRight: di < displayDates.length - 1 ? '1px solid var(--bs-line)' : 'none', display: 'flex', flexDirection: 'column', gap: 2, background: d.toISOString().slice(0, 10) === todayStr ? 'rgba(210,171,75,0.10)' : undefined }}>
                      {slotEvents.map(ev => {
                        const { background, color } = statusStyle(ev.appointmentStatus)
                        const userBorderColor = ev.userId ? (userColorMap[ev.userId] ?? '#C9A84C') : '#C9A84C'
                        const opName = users.find(u => u.id === ev.userId)?.name
                        const startTime = ev.startTime ? new Date(ev.startTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''
                        return (
                          <div
                            key={ev.id}
                            onClick={() => setSelected(ev)}
                            style={{
                              padding: '4px 7px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                              background, color, borderLeft: `3px solid ${userBorderColor}`,
                              lineHeight: 1.3, overflow: 'hidden',
                            }}
                          >
                            <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {startTime && <span style={{ opacity: 0.7, marginRight: 4 }}>{startTime}</span>}
                              {ev.contactName || 'Cliente'}
                            </div>
                            {ev.title && <div style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>}
                            {opName && <div style={{ opacity: 0.65, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>↳ {opName}</div>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <AppointmentModal
          event={selected}
          users={users}
          calendars={calendars}
          onClose={() => setSelected(null)}
          onAction={() => setRefreshKey(k => k + 1)}
        />
      )}
      {showAdd && (
        <AddAppointmentModal
          contacts={contacts}
          calendars={calendars}
          users={users}
          onClose={() => setShowAdd(false)}
          onAdded={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  )
}
