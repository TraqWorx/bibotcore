'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Appointment {
  id: string
  title?: string
  startTime?: string
  endTime?: string
  appointmentStatus?: string
  contactId?: string
  contactName?: string
  calendarId?: string
  userId?: string
}

interface Contact { id: string; firstName: string; lastName: string; email: string; phone: string }
interface CalTeamMember { userId: string }
interface Calendar { id: string; name: string; slotDuration?: number; price?: number; isActive?: boolean; teamMembers?: CalTeamMember[] }

type StatusFilter = 'all' | 'confirmed' | 'pending' | 'cancelled' | 'noshow' | 'showed'

const STATUS_CFG: Record<string, { cls: string; label: string }> = {
  confirmed:  { cls: 'bs-badge-confirmed', label: 'CONFERMATO' },
  new:        { cls: 'bs-badge-confirmed', label: 'CONFERMATO' },
  cancelled:  { cls: 'bs-badge-cancelled', label: 'CANCELLATO' },
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

// ── Reschedule mini-modal ──────────────────────────────────────────────────
function RescheduleModal({ appt, calendars, users, onClose, onDone }: {
  appt: Appointment; calendars: Calendar[]; users: {id: string; name: string}[]
  onClose: () => void; onDone: () => void
}) {
  const cal = calendars.find(c => c.id === appt.calendarId)
  const calTeamIds = new Set((cal?.teamMembers ?? []).map(m => m.userId))
  const calUsers = users.filter(u => calTeamIds.has(u.id))

  const [userId, setUserId] = useState(appt.userId ?? '')
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!appt.calendarId || !date) { setSlots([]); return }
    setLoadingSlots(true); setSlot('')
    const params = new URLSearchParams({ calendarId: appt.calendarId, date })
    if (userId) params.set('userId', userId)
    fetch(`/api/bellessere/free-slots?${params}`)
      .then(r => r.json()).then(d => setSlots(d.slots ?? [])).catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false))
  }, [appt.calendarId, date, userId])

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
        body: JSON.stringify({ eventId: appt.id, startTime: start.toISOString(), endTime: end.toISOString() }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string; message?: string }
      if (!res.ok) { setError(data.message ?? data.error ?? 'Errore'); return }
      onDone(); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Errore') } finally { setSaving(false) }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="bs-modal-overlay" onClick={onClose}>
      <div className="bs-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="bs-modal-header">
          <span className="bs-modal-title">Rischedula appuntamento</span>
          <button className="bs-panel-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="bs-modal-body">
            {error && <div style={{ padding: '10px 14px', background: '#FEF2F2', color: '#DC2626', borderRadius: 9, fontSize: 13 }}>{error}</div>}
            <div style={{ padding: '10px 14px', background: 'var(--bs-bg)', borderRadius: 9, fontSize: 13, color: 'var(--bs-text-muted)' }}>
              Servizio: <strong style={{ color: 'var(--bs-text)' }}>{cal?.name ?? appt.title ?? 'Appuntamento'}</strong>
            </div>
            {calUsers.length > 0 && (
              <div>
                <label className="bs-field-label">Professionista</label>
                <select className="bs-select" value={userId} onChange={e => setUserId(e.target.value)}>
                  <option value="">Qualsiasi disponibile</option>
                  {calUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="bs-field-label">Nuova data *</label>
                <input className="bs-input" type="date" min={today} value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div>
                <label className="bs-field-label">Nuovo orario *</label>
                {loadingSlots
                  ? <div className="bs-input" style={{ color: 'var(--bs-text-faint)', fontSize: 13 }}>Caricamento...</div>
                  : <select className="bs-select" value={slot} onChange={e => setSlot(e.target.value)} required disabled={!date}>
                      <option value="">{!date ? '— prima scegli data —' : slots.length === 0 ? 'Nessuno slot' : 'Scegli orario...'}</option>
                      {slots.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                }
              </div>
            </div>
          </div>
          <div className="bs-modal-footer">
            <button type="button" className="bs-btn-ghost" onClick={onClose}>Annulla</button>
            <button type="submit" className="bs-btn-primary" disabled={saving || !slot}>{saving ? 'Salvataggio...' : 'Conferma rischedula'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Reminder modal ─────────────────────────────────────────────────────────
function ReminderModal({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  const dt = appt.startTime ? new Date(appt.startTime) : null
  const savedTemplate = typeof window !== 'undefined' ? localStorage.getItem('bellessere_reminder_template') : ''
  const builtMsg = savedTemplate
    ? savedTemplate
        .replace('{{nome}}', appt.contactName ?? '')
        .replace('{{servizio}}', appt.title ?? '')
        .replace('{{data}}', dt ? dt.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) : '')
        .replace('{{ora}}', dt ? dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '')
    : `Ciao ${appt.contactName ?? ''}, ti ricordiamo il tuo appuntamento${appt.title ? ` per ${appt.title}` : ''}${dt ? ` il ${dt.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} alle ${dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : ''}.\nPer modifiche contattaci. Bellessere`

  const [msg, setMsg] = useState(builtMsg)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!appt.contactId) { setError('Nessun contatto associato'); return }
    setSending(true); setError('')
    try {
      const convRes = await fetch(`/api/bellessere/contact-conversation?contactId=${appt.contactId}`)
      const convData = await convRes.json().catch(() => ({})) as { conversationId?: string }
      const res = await fetch('/api/bellessere/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convData.conversationId, contactId: appt.contactId, message: msg.trim(), type: 'SMS' }),
      })
      if (!res.ok) { setError('Errore invio'); return }
      setSent(true)
      setTimeout(onClose, 1500)
    } catch { setError('Errore di rete') } finally { setSending(false) }
  }

  return (
    <div className="bs-modal-overlay" onClick={onClose}>
      <div className="bs-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="bs-modal-header">
          <span className="bs-modal-title">Invia reminder</span>
          <button className="bs-panel-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={send}>
          <div className="bs-modal-body">
            {sent
              ? <div style={{ padding: '12px 14px', background: '#F0FDF4', color: '#16A34A', borderRadius: 9, fontSize: 13, textAlign: 'center' }}>Reminder inviato ✓</div>
              : <>
                  {error && <div style={{ padding: '10px 14px', background: '#FEF2F2', color: '#DC2626', borderRadius: 9, fontSize: 13 }}>{error}</div>}
                  <div>
                    <label className="bs-field-label">Messaggio SMS</label>
                    <textarea
                      className="bs-input"
                      style={{ minHeight: 120, resize: 'vertical', lineHeight: 1.5 }}
                      value={msg}
                      onChange={e => setMsg(e.target.value)}
                      disabled={sending}
                    />
                    <div style={{ fontSize: 11.5, color: 'var(--bs-text-faint)', marginTop: 4 }}>{msg.length} caratteri</div>
                  </div>
                </>
            }
          </div>
          {!sent && (
            <div className="bs-modal-footer">
              <button type="button" className="bs-btn-ghost" onClick={onClose}>Annulla</button>
              <button type="submit" className="bs-btn-primary" disabled={sending || !msg.trim()}>{sending ? 'Invio...' : 'Invia reminder'}</button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

// ── Appointment detail panel ───────────────────────────────────────────────
function AppointmentPanel({
  appt, calendars, users, onClose, onAction,
}: {
  appt: Appointment; calendars: Calendar[]; users: {id: string; name: string}[]
  onClose: () => void; onAction: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [showReschedule, setShowReschedule] = useState(false)
  const [showReminder, setShowReminder] = useState(false)

  const calendar = calendars.find(c => c.id === appt.calendarId)
  const operator = users.find(u => u.id === appt.userId)
  const dt = appt.startTime ? new Date(appt.startTime) : null
  const dtEnd = appt.endTime ? new Date(appt.endTime) : null
  const duration = dt && dtEnd ? Math.round((dtEnd.getTime() - dt.getTime()) / 60000) : calendar?.slotDuration ?? null

  async function setStatus(status: string) {
    setLoading(true); setActionError('')
    const res = await fetch('/api/bellessere/appointments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: appt.id, appointmentStatus: status }),
    })
    const data = await res.json().catch(() => ({})) as { message?: string; error?: string }
    setLoading(false)
    if (!res.ok) { setActionError(data.message ?? data.error ?? 'Errore aggiornamento'); return }
    onAction(); onClose()
  }

  const st = appt.appointmentStatus ?? 'new'

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
            <Badge s={st} />
            <span style={{ fontSize: 11, color: 'var(--bs-text-faint)' }}>#{appt.id.slice(-6).toUpperCase()}</span>
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
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
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
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5V5c0-.83.67-1.5 1.5-1.5"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--bs-text-faint)', marginBottom: 2 }}>Servizio</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{appt.title || calendar?.name}</div>
                </div>
              </div>
            )}
            {operator && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bs-gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--bs-text-faint)', marginBottom: 2 }}>Operatore</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{operator.name}</div>
                </div>
              </div>
            )}
            {(duration || calendar?.price) && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bs-gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--bs-text-faint)', marginBottom: 2 }}>Durata e prezzo</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{duration ? `${duration} min` : '—'}{calendar?.price ? ` · €${calendar.price}` : ''}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bs-panel-actions">
          {actionError && <div style={{ padding: '8px 12px', background: '#FEF2F2', color: '#DC2626', borderRadius: 8, fontSize: 12.5 }}>{actionError}</div>}

          {st !== 'showed' && (
            <button className="bs-btn-primary" style={{ justifyContent: 'center', width: '100%' }} onClick={() => setStatus('showed')} disabled={loading}>
              Segna come completato
            </button>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button className="bs-btn-ghost" style={{ justifyContent: 'center' }} onClick={() => setShowReschedule(true)} disabled={loading}>
              Rischedula
            </button>
            {st !== 'confirmed' && st !== 'showed' && (
              <button className="bs-btn-ghost" style={{ justifyContent: 'center' }} onClick={() => setStatus('confirmed')} disabled={loading}>
                Conferma
              </button>
            )}
            {st !== 'cancelled' && (
              <button className="bs-btn-danger" style={{ justifyContent: 'center' }} onClick={() => setStatus('cancelled')} disabled={loading}>
                Cancella
              </button>
            )}
            {st !== 'noshow' && st !== 'no-show' && st !== 'cancelled' && (
              <button className="bs-btn-ghost" style={{ justifyContent: 'center' }} onClick={() => setStatus('no-show')} disabled={loading}>
                No-show
              </button>
            )}
          </div>

          {appt.contactId && (
            <button className="bs-btn-ghost" style={{ justifyContent: 'center', width: '100%' }} onClick={() => setShowReminder(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              Invia reminder
            </button>
          )}
        </div>
      </div>

      {showReschedule && (
        <RescheduleModal
          appt={appt}
          calendars={calendars}
          users={users}
          onClose={() => setShowReschedule(false)}
          onDone={() => { onAction(); onClose() }}
        />
      )}
      {showReminder && <ReminderModal appt={appt} onClose={() => setShowReminder(false)} />}
    </>
  )
}

// ── Contact combobox ───────────────────────────────────────────────────────
function ContactCombobox({ contacts, value, onChange }: {
  contacts: Contact[]
  value: string
  onChange: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const displayName = (c: Contact) => `${c.firstName} ${c.lastName}`.trim() || c.email || c.phone
  const selected = contacts.find(c => c.id === value)

  const results = query.length > 0
    ? contacts.filter(c => {
        const q = query.toLowerCase()
        return displayName(c).toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q)
      }).slice(0, 30)
    : contacts.slice(0, 30)

  function pick(id: string) { onChange(id); setQuery(''); setOpen(false) }

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="bs-input"
        placeholder="Cerca cliente..."
        autoComplete="off"
        value={open ? query : (selected ? displayName(selected) : '')}
        onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="bs-combo-popover">
          <div onMouseDown={() => pick('')} className="bs-combo-option" style={{ color: 'var(--bs-text-muted)' }}>
            Senza cliente
          </div>
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

// ── Add appointment modal ──────────────────────────────────────────────────
function AddAppointmentModal({ onClose, onAdded, contacts, calendars, users, preselectedContactId }: {
  onClose: () => void; onAdded: () => void; contacts: Contact[]; calendars: Calendar[]
  users: { id: string; name: string }[]; preselectedContactId?: string
}) {
  const [form, setForm] = useState({ contactId: preselectedContactId ?? '', calendarId: '', userId: '', date: '', slot: '', appointmentStatus: 'confirmed' })
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedCal = calendars.find(c => c.id === form.calendarId)
  const calTeamIds = new Set((selectedCal?.teamMembers ?? []).map(m => m.userId))
  const calUsers = users.filter(u => calTeamIds.has(u.id))

  useEffect(() => {
    setForm(p => ({ ...p, userId: '', slot: '' }))
  }, [form.calendarId])

  useEffect(() => {
    if (!form.calendarId || !form.date) { setSlots([]); return }
    setLoadingSlots(true); setForm(p => ({ ...p, slot: '' }))
    const params = new URLSearchParams({ calendarId: form.calendarId, date: form.date })
    if (form.userId) params.set('userId', form.userId)
    fetch(`/api/bellessere/free-slots?${params}`)
      .then(r => r.json()).then(d => setSlots(d.slots ?? [])).catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false))
  }, [form.calendarId, form.date, form.userId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.calendarId || !form.date || !form.slot) { setError('Seleziona servizio, data e orario'); return }
    setSaving(true); setError('')
    try {
      const cal = calendars.find(c => c.id === form.calendarId)
      const tzParts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', timeZoneName: 'longOffset' })
        .formatToParts(new Date(`${form.date}T12:00:00Z`))
      const offsetStr = (tzParts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+02:00').replace('GMT', '')
      const start = new Date(`${form.date}T${form.slot}:00${offsetStr}`)
      const end = new Date(start.getTime() + (cal?.slotDuration ?? 30) * 60000)
      const res = await fetch('/api/bellessere/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: form.calendarId,
          contactId: form.contactId || undefined,
          userId: form.userId || undefined,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          appointmentStatus: form.appointmentStatus,
          title: cal?.name ?? 'Appuntamento',
          selectedTimezone: 'Europe/Rome',
        }),
      })
      const data = await res.json().catch(() => ({})) as { message?: string; error?: string }
      if (!res.ok) { setError(data.message ?? data.error ?? 'Errore creazione appuntamento'); return }
      setTimeout(onAdded, 1200)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di rete')
    } finally { setSaving(false) }
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
              <select className="bs-select" value={form.calendarId} onChange={e => setForm(p => ({ ...p, calendarId: e.target.value, slot: '' }))} required>
                <option value="">Seleziona servizio...</option>
                {calendars.filter(c => c.isActive !== false).map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.price ? ` — €${c.price}` : ''}</option>
                ))}
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
                      <option value="">{!form.calendarId || !form.date ? '— prima scegli data —' : slots.length === 0 ? 'Nessuno slot disponibile' : 'Scegli orario...'}</option>
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

// ── Helpers ────────────────────────────────────────────────────────────────
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

// ── Page ───────────────────────────────────────────────────────────────────
export default function AppuntamentiPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchAppointments = useCallback(() => {
    const start = new Date(); start.setMonth(start.getMonth() - 1)
    const end = new Date(); end.setMonth(end.getMonth() + 3)
    return fetch(`/api/bellessere/appointments?startTime=${start.toISOString()}&endTime=${end.toISOString()}`)
      .then(r => r.json())
      .then(evtsData => { setAppointments(evtsData.events ?? []) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const start = new Date(); start.setMonth(start.getMonth() - 1)
    const end = new Date(); end.setMonth(end.getMonth() + 3)
    setLoading(true)
    Promise.all([
      fetch(`/api/bellessere/appointments?startTime=${start.toISOString()}&endTime=${end.toISOString()}`).then(r => r.json()),
      fetch('/api/bellessere/contacts').then(r => r.json()),
      fetch('/api/bellessere/services').then(r => r.json()),
    ]).then(([evtsData, ctData, svcData]) => {
      setAppointments(evtsData.events ?? [])
      setContacts(ctData.contacts ?? [])
      setCalendars(svcData.calendars ?? [])
      setUsers((svcData.users ?? []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [refreshKey])

  useEffect(() => {
    const channel = supabase
      .channel('bellessere-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cached_calendar_events', filter: `location_id=eq.${BELLESSERE_LOCATION_ID}` },
        () => { fetchAppointments() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchAppointments])

  const filtered = useMemo(() => {
    let list = appointments
    if (filter !== 'all') {
      list = list.filter(a => {
        const s = a.appointmentStatus ?? 'new'
        if (filter === 'confirmed') return s === 'confirmed' || s === 'new'
        if (filter === 'pending') return s === 'pending'
        if (filter === 'showed') return s === 'showed'
        if (filter === 'cancelled') return s === 'cancelled'
        if (filter === 'noshow') return s === 'no-show' || s === 'noshow'
        return true
      })
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(a => {
        const opName = users.find(u => u.id === a.userId)?.name ?? ''
        return (a.contactName ?? '').toLowerCase().includes(q) || (a.title ?? '').toLowerCase().includes(q) || opName.toLowerCase().includes(q)
      })
    }
    return list
  }, [appointments, filter, search, users])

  const todayStr = new Date().toISOString().slice(0, 10)
  const totalToday = appointments.filter(a => a.startTime?.slice(0, 10) === todayStr).length
  const pending = appointments.filter(a => a.appointmentStatus === 'pending' || (!a.appointmentStatus)).length
  const confirmed = appointments.filter(a => a.appointmentStatus === 'confirmed' || a.appointmentStatus === 'new').length
  const noshow = appointments.filter(a => a.appointmentStatus === 'no-show' || a.appointmentStatus === 'noshow').length

  const groups = groupByDate(filtered)

  const FILTER_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Tutti' },
    { key: 'cancelled', label: 'Cancellati' },
    { key: 'confirmed', label: 'Confermati' },
    { key: 'showed', label: 'Completati' },
    { key: 'noshow', label: 'No-show' },
  ]

  return (
    <div className="bs-page-stack">
      <div className="bs-page-header">
        <div className="bs-page-header-start">
          <div className="bs-page-eyebrow">Gestione</div>
          <h1 className="bs-page-title">Appuntamenti</h1>
          <div className="bs-page-subtitle">Filtra, controlla e aggiorna ogni prenotazione con azioni rapide e dettagli cliente.</div>
        </div>
        <div className="bs-page-actions">
        <button className="bs-btn-primary" onClick={() => setShowAdd(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuovo appuntamento
        </button>
        </div>
      </div>

      <div className="bs-stats-grid">
        {[
          { value: totalToday, label: 'Oggi', color: 'var(--bs-text)' },
          { value: confirmed, label: 'Confermati', color: 'var(--bs-text)' },
          { value: noshow, label: 'No-show', color: 'var(--bs-danger)' },
        ].map(s => (
          <div key={s.label} className="bs-stat-card">
            <div className="bs-stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="bs-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bs-card">
        <div className="bs-filter-bar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <div className="bs-search-wrap">
            <svg className="bs-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="bs-search-input"
              placeholder="Cerca per cliente, servizio o operatore..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="bs-filter-tabs" style={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>
            {FILTER_TABS.map(t => (
              <button key={t.key} className="bs-filter-tab" data-active={filter === t.key ? 'true' : 'false'} onClick={() => setFilter(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bs-loading-state">Caricamento appuntamenti...</div>
      ) : groups.length === 0 ? (
        <div className="bs-empty-state">Nessun appuntamento trovato.</div>
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
                const operator = users.find(u => u.id === a.userId)
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
                      <div style={{ fontSize: 12, color: 'var(--bs-text-muted)' }}>
                        {a.title || cal?.name || 'Appuntamento'}
                        {operator && <span style={{ opacity: 0.7 }}> · {operator.name}</span>}
                      </div>
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
          users={users}
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
          users={users}
        />
      )}
    </div>
  )
}
