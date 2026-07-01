'use client'

import { useState, useEffect, useMemo } from 'react'

interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  companyName: string
  dateAdded: string
  tags: string[]
}

interface Calendar { id: string; name: string; slotDuration?: number; price?: number; isActive?: boolean; teamMembers?: { userId: string }[] }

interface Appointment {
  id: string
  title?: string
  startTime?: string
  endTime?: string
  appointmentStatus?: string
  contactId?: string
  calendarId?: string
  userId?: string
}

function initials(c: Contact) {
  return `${c.firstName[0] ?? ''}${c.lastName[0] ?? ''}`.toUpperCase() || '?'
}

function fullName(c: Contact) {
  return `${c.firstName} ${c.lastName}`.trim() || c.email || c.phone || '—'
}

interface Message { id: string; body: string; direction: string; dateAdded: string }

function TagEditor({ contactId, initialTags }: { contactId: string; initialTags: string[] }) {
  const [tags, setTags] = useState<string[]>(initialTags)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  async function saveTags(next: string[]) {
    setSaving(true); setSaveError('')
    const res = await fetch('/api/bellessere/contacts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, tags: next }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) setSaveError('Errore nel salvataggio tag')
  }

  async function addTag() {
    const tag = input.trim()
    if (!tag || tags.includes(tag)) { setInput(''); return }
    const next = [...tags, tag]
    setTags(next)
    setInput('')
    await saveTags(next)
  }

  async function removeTag(tag: string) {
    const next = tags.filter(t => t !== tag)
    setTags(next)
    await saveTags(next)
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bs-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Tag</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {tags.map(t => (
          <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 10px', background: 'var(--bs-gold-tint)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 100, fontSize: 12 }}>
            {t}
            <button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bs-gold)', padding: 0, fontSize: 12, lineHeight: 1, opacity: saving ? 0.4 : 1 }} disabled={saving}>×</button>
          </span>
        ))}
        {tags.length === 0 && <span style={{ fontSize: 12, color: 'var(--bs-text-faint)' }}>Nessun tag</span>}
      </div>
      {saveError && <div style={{ fontSize: 11.5, color: '#DC2626', marginBottom: 4 }}>{saveError}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="bs-input"
          style={{ fontSize: 12.5, height: 32 }}
          placeholder="Aggiungi tag..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          disabled={saving}
        />
        <button
          className="bs-btn-ghost"
          style={{ padding: '0 12px', height: 32, fontSize: 12, flexShrink: 0 }}
          onClick={addTag}
          disabled={saving || !input.trim()}
        >
          Aggiungi
        </button>
      </div>
    </div>
  )
}

function CustomerPanel({ contact, onClose, onBookAppointment }: {
  contact: Contact; onClose: () => void; onBookAppointment: (contactId: string) => void
}) {
  const [tab, setTab] = useState<'appuntamenti' | 'messaggi'>('appuntamenti')
  const [events, setEvents] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [apptSearch, setApptSearch] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setLoading(true)
    const start = new Date(); start.setFullYear(start.getFullYear() - 3)
    const end = new Date(); end.setMonth(end.getMonth() + 6)
    Promise.all([
      fetch(`/api/bellessere/appointments?startTime=${start.toISOString()}&endTime=${end.toISOString()}`).then(r => r.json()),
      fetch(`/api/bellessere/contact-conversation?contactId=${contact.id}`).then(r => r.json()),
    ]).then(([apptData, convData]) => {
      setEvents((apptData.events ?? [])
        .filter((e: { contactId?: string }) => e.contactId === contact.id)
        .map((e: Appointment) => ({ id: e.id, title: e.title, startTime: e.startTime, endTime: e.endTime, appointmentStatus: e.appointmentStatus, contactId: e.contactId, calendarId: e.calendarId, userId: e.userId }))
        .sort((a: Appointment, b: Appointment) => (b.startTime ?? '').localeCompare(a.startTime ?? '')))
      setConversationId(convData.conversationId ?? null)
      setMessages(convData.messages ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [contact.id])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!msgText.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/bellessere/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, contactId: contact.id, message: msgText.trim(), type: 'SMS' }),
      })
      if (res.ok) {
        setMessages(prev => [...prev, { id: Date.now().toString(), body: msgText.trim(), direction: 'outbound', dateAdded: new Date().toISOString() }])
        setMsgText('')
      }
    } catch { /* ignore */ } finally { setSending(false) }
  }

  const memberSince = contact.dateAdded
    ? new Date(contact.dateAdded).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    : null

  const STATUS_CLS: Record<string, string> = {
    confirmed: 'bs-badge-confirmed', new: 'bs-badge-confirmed',
    cancelled: 'bs-badge-cancelled', showed: 'bs-badge-showed',
  }
  const STATUS_LBL: Record<string, string> = {
    confirmed: 'Confermato', new: 'Confermato', cancelled: 'Annullato', showed: 'Completato',
  }

  return (
    <>
      <div className="bs-overlay" onClick={onClose} />
      <div className="bs-panel" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="bs-panel-header">
          <span className="bs-panel-title">Dettagli cliente</span>
          <button className="bs-panel-close" onClick={onClose}>✕</button>
        </div>

        {/* Scrollable top section: avatar, contact info, stats, tags */}
        <div className="bs-panel-body" style={{ flex: '0 0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
            <div className="bs-avatar" style={{ width: 60, height: 60, fontSize: 20 }}>{initials(contact)}</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{fullName(contact)}</div>
              {memberSince && <div style={{ fontSize: 12, color: 'var(--bs-text-faint)', marginTop: 2 }}>Cliente dal {memberSince}</div>}
            </div>
          </div>

          <div className="bs-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {contact.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bs-gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--bs-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Email</div>
                  <div style={{ fontSize: 13.5 }}>{contact.email}</div>
                </div>
              </div>
            )}
            {contact.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bs-gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 10a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.37h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8 9a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16c.06.44.06.89 0 1.33z"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--bs-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Telefono</div>
                  <div style={{ fontSize: 13.5 }}>{contact.phone}</div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--bs-line)' }}>
            {[
              { value: events.length, label: 'Prenotazioni' },
              { value: events.filter(e => e.appointmentStatus === 'showed').length, label: 'Completati' },
              { value: events.filter(e => e.appointmentStatus === 'cancelled').length, label: 'Annullati' },
            ].map((s, i) => (
              <div key={s.label} style={{ padding: '14px 10px', textAlign: 'center', background: 'white', borderRight: i < 2 ? '1px solid var(--bs-line)' : 'none' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--bs-text)', letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontSize: 11.5, color: 'var(--bs-text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <TagEditor contactId={contact.id} initialTags={contact.tags} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderTop: '1px solid var(--bs-line)', borderBottom: '1px solid var(--bs-line)', flexShrink: 0 }}>
          {(['appuntamenti', 'messaggi'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: tab === t ? 700 : 500,
              color: tab === t ? 'var(--bs-text)' : 'var(--bs-text-faint)',
              borderBottom: tab === t ? '2px solid var(--bs-black)' : '2px solid transparent',
              textTransform: 'capitalize', transition: 'all 0.15s',
            }}>
              {t === 'appuntamenti' ? 'Appuntamenti' : 'Messaggi'}
            </button>
          ))}
        </div>

        {/* Tab content — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tab === 'appuntamenti' && (
            <>
              <button className="bs-btn-primary" style={{ justifyContent: 'center', width: '100%' }}
                onClick={() => { onClose(); onBookAppointment(contact.id) }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Prenota appuntamento
              </button>

              {events.length > 5 && (
                <div className="bs-search-wrap" style={{ background: 'var(--bs-bg)', borderRadius: 8 }}>
                  <svg className="bs-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input className="bs-search-input" placeholder="Cerca appuntamento..." value={apptSearch} onChange={e => setApptSearch(e.target.value)} style={{ fontSize: 12.5 }} />
                </div>
              )}

              {loading ? (
                <div style={{ fontSize: 12.5, color: 'var(--bs-text-faint)' }}>Caricamento...</div>
              ) : events.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--bs-text-faint)' }}>Nessun appuntamento trovato.</div>
              ) : events
                .filter(ev => !apptSearch || (ev.title ?? '').toLowerCase().includes(apptSearch.toLowerCase()) || (ev.startTime ?? '').includes(apptSearch))
                .map(ev => {
                  const cls = STATUS_CLS[ev.appointmentStatus ?? 'new'] ?? 'bs-badge-pending'
                  const lbl = STATUS_LBL[ev.appointmentStatus ?? 'new'] ?? 'In attesa'
                  const isFuture = ev.startTime && new Date(ev.startTime) > new Date()
                  return (
                    <div key={ev.id} style={{ padding: '10px 14px', background: 'var(--bs-bg)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: isFuture ? 1 : 0.85 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.title || 'Appuntamento'}</div>
                        {ev.startTime && (
                          <div style={{ fontSize: 11.5, color: 'var(--bs-text-muted)' }}>
                            {new Date(ev.startTime).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                        )}
                      </div>
                      <span className={`bs-badge ${cls}`}>{lbl}</span>
                    </div>
                  )
                })
              }
            </>
          )}

          {tab === 'messaggi' && (
            <>
              {!conversationId && !loading ? (
                <div style={{ fontSize: 12.5, color: 'var(--bs-text-faint)', textAlign: 'center', padding: '20px 0' }}>
                  Nessuna conversazione con questo cliente.
                </div>
              ) : loading ? (
                <div style={{ fontSize: 12.5, color: 'var(--bs-text-faint)' }}>Caricamento...</div>
              ) : messages.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--bs-text-faint)', textAlign: 'center', padding: '20px 0' }}>
                  Nessun messaggio con questo cliente.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {messages.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: m.direction === 'outbound' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '80%', padding: '7px 12px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.4,
                        background: m.direction === 'outbound' ? 'var(--bs-black)' : 'var(--bs-bg)',
                        color: m.direction === 'outbound' ? 'white' : 'var(--bs-text)',
                        borderBottomRightRadius: m.direction === 'outbound' ? 4 : 12,
                        borderBottomLeftRadius: m.direction === 'inbound' ? 4 : 12,
                      }}>
                        {m.body}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {conversationId && (
                <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
                  <input
                    className="bs-input"
                    style={{ flex: 1, fontSize: 13 }}
                    placeholder="Scrivi un messaggio..."
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    disabled={sending}
                  />
                  <button type="submit" className="bs-btn-primary" style={{ padding: '0 14px', flexShrink: 0 }} disabled={sending || !msgText.trim()}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function AddCustomerModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', companyName: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/bellessere/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Errore'); return }
      onAdded(); onClose()
    } catch { setError('Errore di rete') } finally { setSaving(false) }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="bs-modal-overlay" onClick={onClose}>
      <div className="bs-modal" onClick={e => e.stopPropagation()}>
        <div className="bs-modal-header">
          <span className="bs-modal-title">Nuovo cliente</span>
          <button className="bs-panel-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="bs-modal-body">
            {error && <div style={{ padding: '10px 14px', background: '#FEF2F2', color: '#DC2626', borderRadius: 9, fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div><label className="bs-field-label">Nome</label><input className="bs-input" value={form.firstName} onChange={f('firstName')} placeholder="Mario" /></div>
              <div><label className="bs-field-label">Cognome</label><input className="bs-input" value={form.lastName} onChange={f('lastName')} placeholder="Rossi" /></div>
            </div>
            <div><label className="bs-field-label">Email</label><input className="bs-input" type="email" value={form.email} onChange={f('email')} placeholder="mario@email.com" /></div>
            <div><label className="bs-field-label">Telefono</label><input className="bs-input" type="tel" value={form.phone} onChange={f('phone')} placeholder="+39 333 1234567" /></div>
            <div><label className="bs-field-label">Azienda (opzionale)</label><input className="bs-input" value={form.companyName} onChange={f('companyName')} /></div>
          </div>
          <div className="bs-modal-footer">
            <button type="button" className="bs-btn-ghost" onClick={onClose}>Annulla</button>
            <button type="submit" className="bs-btn-primary" disabled={saving}>{saving ? 'Salvataggio...' : 'Aggiungi cliente'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Minimal AddAppointmentModal inline (re-uses shared logic) ────────────
function AddAppointmentModal({ onClose, onAdded, contacts, preselectedContactId }: {
  onClose: () => void; onAdded: () => void; contacts: Contact[]; preselectedContactId?: string
}) {
  interface CalEntry { id: string; name: string; slotDuration?: number; price?: number; isActive?: boolean; teamMembers?: { userId: string }[] }
  const [calendars, setCalendars] = useState<CalEntry[]>([])
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({ contactId: preselectedContactId ?? '', calendarId: '', userId: '', date: '', slot: '', appointmentStatus: 'confirmed' })
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/bellessere/services').then(r => r.json()).then(d => {
      setCalendars(d.calendars ?? [])
      setUsers((d.users ?? []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })))
    }).catch(() => {})
  }, [])

  const selectedCal = calendars.find(c => c.id === form.calendarId)
  const calTeamIds = new Set((selectedCal?.teamMembers ?? []).map(m => m.userId))
  const calUsers = users.filter(u => calTeamIds.has(u.id))

  useEffect(() => { setForm(p => ({ ...p, userId: '', slot: '' })) }, [form.calendarId])

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
          calendarId: form.calendarId, contactId: form.contactId || undefined,
          userId: form.userId || undefined, startTime: start.toISOString(), endTime: end.toISOString(),
          appointmentStatus: form.appointmentStatus, title: cal?.name ?? 'Appuntamento', selectedTimezone: 'Europe/Rome',
        }),
      })
      const data = await res.json().catch(() => ({})) as { message?: string; error?: string }
      if (!res.ok) { setError(data.message ?? data.error ?? 'Errore'); return }
      setTimeout(onAdded, 1200); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Errore di rete') } finally { setSaving(false) }
  }

  // Reuse ContactCombobox logic inline
  const [query, setQuery] = useState('')
  const [comboOpen, setComboOpen] = useState(false)
  const displayName = (c: Contact) => `${c.firstName} ${c.lastName}`.trim() || c.email || c.phone
  const selectedContact = contacts.find(c => c.id === form.contactId)
  const results = query.length > 0
    ? contacts.filter(c => displayName(c).toLowerCase().includes(query.toLowerCase()) || c.phone?.includes(query)).slice(0, 30)
    : contacts.slice(0, 30)

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
                {calendars.filter(c => c.isActive !== false).map(c => <option key={c.id} value={c.id}>{c.name}{c.price ? ` — €${c.price}` : ''}</option>)}
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
              <div style={{ position: 'relative' }}>
                <input className="bs-input" placeholder="Cerca cliente..." autoComplete="off"
                  value={comboOpen ? query : (selectedContact ? displayName(selectedContact) : '')}
                  onChange={e => { setQuery(e.target.value); if (!comboOpen) setComboOpen(true) }}
                  onFocus={() => setComboOpen(true)} onBlur={() => setTimeout(() => setComboOpen(false), 150)} />
                {comboOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid var(--bs-line)', borderRadius: 9, maxHeight: 200, overflowY: 'auto', zIndex: 200, boxShadow: '0 6px 20px rgba(0,0,0,0.12)' }}>
                    <div onMouseDown={() => { setForm(p => ({ ...p, contactId: '' })); setQuery(''); setComboOpen(false) }} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--bs-text-muted)', borderBottom: '1px solid var(--bs-line)' }}>Senza cliente</div>
                    {results.length === 0
                      ? <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--bs-text-faint)' }}>Nessun risultato</div>
                      : results.map(c => (
                        <div key={c.id} onMouseDown={() => { setForm(p => ({ ...p, contactId: c.id })); setQuery(''); setComboOpen(false) }}
                          style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, fontWeight: c.id === form.contactId ? 600 : 400, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{displayName(c)}</span>
                          {c.phone && <span style={{ fontSize: 11, color: 'var(--bs-text-faint)' }}>{c.phone}</span>}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
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
                <option value="new">In attesa</option>
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

export default function ClientiPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [bookingCounts, setBookingCounts] = useState<Record<string, number>>({})
  const [lastBooking, setLastBooking] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Contact | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [bookForContact, setBookForContact] = useState<string | undefined>(undefined)

  useEffect(() => {
    setLoading(true)
    const start = new Date(); start.setFullYear(start.getFullYear() - 2)
    const end = new Date(); end.setMonth(end.getMonth() + 6)
    Promise.all([
      fetch('/api/bellessere/contacts').then(r => r.json()),
      fetch(`/api/bellessere/appointments?startTime=${start.toISOString()}&endTime=${end.toISOString()}`).then(r => r.json()),
    ]).then(([ct, appts]) => {
      setContacts(ct.contacts ?? [])
      const counts: Record<string, number> = {}
      const last: Record<string, string> = {}
      for (const e of (appts.events ?? [])) {
        if (!e.contactId) continue
        counts[e.contactId] = (counts[e.contactId] ?? 0) + 1
        if (e.startTime && (!last[e.contactId] || e.startTime > last[e.contactId])) {
          last[e.contactId] = e.startTime
        }
      }
      setBookingCounts(counts)
      setLastBooking(last)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [refreshKey])

  const filtered = useMemo(() => {
    if (!search) return contacts
    const q = search.toLowerCase()
    return contacts.filter(c =>
      fullName(c).toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q)
    )
  }, [contacts, search])

  // Sort by most recent booking desc, then alphabetically
  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      const la = lastBooking[a.id] ?? ''
      const lb = lastBooking[b.id] ?? ''
      if (lb !== la) return lb > la ? 1 : -1
      return fullName(a).localeCompare(fullName(b))
    }),
    [filtered, lastBooking]
  )

  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0,0,0,0)
  const newThisMonth = contacts.filter(c => c.dateAdded && new Date(c.dateAdded) >= thisMonth).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="bs-page-eyebrow">Gestione</div>
          <h1 className="bs-page-title">Clienti</h1>
        </div>
        <button className="bs-btn-primary" onClick={() => setShowAdd(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Aggiungi cliente
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { value: contacts.length, label: 'Clienti totali' },
          { value: newThisMonth, label: 'Nuovi questo mese' },
          { value: contacts.filter(c => c.email).length, label: 'Con email' },
          { value: contacts.filter(c => c.phone).length, label: 'Con telefono' },
        ].map(s => (
          <div key={s.label} className="bs-stat-card">
            <div className="bs-stat-value">{s.value}</div>
            <div className="bs-stat-label">{s.label}</div>
          </div>
        ))}
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
              placeholder="Cerca per nome, email o telefono..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--bs-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>Tutti i clienti</span>
          <span style={{ fontSize: 12.5, color: 'var(--bs-text-muted)' }}>{loading ? '...' : `${sorted.length} trovati`}</span>
        </div>

        {!loading && sorted.map(c => {
          const count = bookingCounts[c.id] ?? 0
          const last = lastBooking[c.id]
          const lastLabel = last
            ? new Date(last) > new Date()
              ? `Prossimo: ${new Date(last).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`
              : `Ultima: ${new Date(last).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' })}`
            : null
          return (
            <div key={c.id} className="bs-list-row" onClick={() => setSelected(c)}>
              <div className="bs-avatar">{initials(c)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{fullName(c)}</div>
                <div style={{ fontSize: 12, color: 'var(--bs-text-muted)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                  {c.phone && <span>{c.phone}</span>}
                  {c.phone && c.email && <span style={{ color: 'var(--bs-line)' }}>·</span>}
                  {c.email && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{c.email}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {count > 0 && (
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--bs-text)' }}>
                    {count} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--bs-text-faint)' }}>prenotaz.</span>
                  </div>
                )}
                {lastLabel && <div style={{ fontSize: 11.5, color: 'var(--bs-text-faint)', marginTop: 1 }}>{lastLabel}</div>}
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--bs-text-faint)" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          )
        })}
      </div>

      {selected && (
        <CustomerPanel
          contact={selected}
          onClose={() => setSelected(null)}
          onBookAppointment={(contactId) => { setSelected(null); setBookForContact(contactId) }}
        />
      )}
      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} onAdded={() => setRefreshKey(k => k + 1)} />}
      {bookForContact !== undefined && (
        <AddAppointmentModal
          contacts={contacts}
          preselectedContactId={bookForContact}
          onClose={() => setBookForContact(undefined)}
          onAdded={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  )
}
