'use client'

import { useState, useEffect, useMemo } from 'react'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

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

interface Appointment {
  id: string
  title?: string
  startTime?: string
  appointmentStatus?: string
}

function initials(c: Contact) {
  return `${c.firstName[0] ?? ''}${c.lastName[0] ?? ''}`.toUpperCase() || '?'
}

function fullName(c: Contact) {
  return `${c.firstName} ${c.lastName}`.trim() || c.email || c.phone || '—'
}

function statusBadge(s: string) {
  const map: Record<string, [string, string]> = {
    confirmed: ['bs-badge-confirmed', 'Confermato'],
    new: ['bs-badge-confirmed', 'Confermato'],
    cancelled: ['bs-badge-cancelled', 'Annullato'],
    showed: ['bs-badge-showed', 'Completato'],
  }
  const [cls, label] = map[s] ?? ['bs-badge-pending', 'In attesa']
  return <span className={`bs-badge ${cls}`}>{label}</span>
}

function CustomerPanel({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const [events, setEvents] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const start = new Date()
    start.setMonth(start.getMonth() - 6)
    const end = new Date()
    end.setMonth(end.getMonth() + 2)
    fetch(`/api/bellessere/appointments?startTime=${start.toISOString()}&endTime=${end.toISOString()}`)
      .then(r => r.json())
      .then(d => {
        const evts: Appointment[] = (d.events ?? [])
          .filter((e: { contactId?: string }) => e.contactId === contact.id)
          .map((e: { id: string; title?: string; startTime?: string; appointmentStatus?: string }) => ({
            id: e.id, title: e.title, startTime: e.startTime, appointmentStatus: e.appointmentStatus,
          }))
        setEvents(evts)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [contact.id])

  return (
    <>
      <div className="bs-overlay" onClick={onClose} />
      <div className="bs-panel">
        <div className="bs-panel-header">
          <span className="bs-panel-title">Dettagli cliente</span>
          <button className="bs-panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="bs-panel-body">
          {/* Avatar + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="bs-avatar" style={{ width: 52, height: 52, fontSize: 18 }}>{initials(contact)}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{fullName(contact)}</div>
              {contact.companyName && <div style={{ fontSize: 12.5, color: 'var(--bs-text-muted)' }}>{contact.companyName}</div>}
            </div>
          </div>

          {/* Contact info */}
          <div className="bs-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {contact.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bs-text-faint)" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <span style={{ fontSize: 13.5 }}>{contact.email}</span>
              </div>
            )}
            {contact.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bs-text-faint)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 10a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.37h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8 9a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16c.06.44.06.89 0 1.33z"/></svg>
                <span style={{ fontSize: 13.5 }}>{contact.phone}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {contact.tags.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--bs-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Tag</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {contact.tags.map(t => (
                  <span key={t} style={{ padding: '3px 10px', background: 'var(--bs-bg)', border: '1px solid var(--bs-line)', borderRadius: 100, fontSize: 12 }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Recent appointments */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Appuntamenti recenti</div>
            {loading ? (
              <div style={{ fontSize: 12.5, color: 'var(--bs-text-faint)' }}>Caricamento...</div>
            ) : events.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--bs-text-faint)' }}>Nessun appuntamento trovato.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {events.slice(0, 5).map(ev => (
                  <div key={ev.id} style={{ padding: '10px 12px', background: 'var(--bs-bg)', borderRadius: 9, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.title || 'Appuntamento'}</div>
                      {ev.startTime && (
                        <div style={{ fontSize: 11.5, color: 'var(--bs-text-muted)' }}>
                          {new Date(ev.startTime).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      )}
                    </div>
                    {statusBadge(ev.appointmentStatus ?? 'new')}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="bs-panel-actions">
          <a href="/designs/bellessere/appuntamenti" className="bs-btn-primary" style={{ justifyContent: 'center' }}>
            Prenota appuntamento
          </a>
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
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/bellessere/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Errore'); return }
      onAdded()
      onClose()
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
            {error && <div style={{ padding: '10px 12px', background: '#FEF2F2', color: '#DC2626', borderRadius: 8, fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="bs-field-label">Nome</label>
                <input className="bs-input" value={form.firstName} onChange={f('firstName')} placeholder="Mario" />
              </div>
              <div>
                <label className="bs-field-label">Cognome</label>
                <input className="bs-input" value={form.lastName} onChange={f('lastName')} placeholder="Rossi" />
              </div>
            </div>
            <div>
              <label className="bs-field-label">Email</label>
              <input className="bs-input" type="email" value={form.email} onChange={f('email')} placeholder="mario@email.com" />
            </div>
            <div>
              <label className="bs-field-label">Telefono</label>
              <input className="bs-input" type="tel" value={form.phone} onChange={f('phone')} placeholder="+39 333 1234567" />
            </div>
            <div>
              <label className="bs-field-label">Azienda (opzionale)</label>
              <input className="bs-input" value={form.companyName} onChange={f('companyName')} placeholder="Nome azienda" />
            </div>
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

export default function ClientiPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Contact | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/contacts?locationId=${BELLESSERE_LOCATION_ID}&pageSize=200`)
      .then(r => r.json())
      .then(d => setContacts(d.contacts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [refreshKey])

  const filtered = useMemo(() => {
    if (!search) return contacts
    const s = search.toLowerCase()
    return contacts.filter(c =>
      fullName(c).toLowerCase().includes(s) ||
      c.email.toLowerCase().includes(s) ||
      c.phone.includes(s)
    )
  }, [contacts, search])

  const total = contacts.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="bs-page-eyebrow">Gestione</div>
          <h1 className="bs-page-title">Clienti</h1>
        </div>
        <button className="bs-btn-primary" onClick={() => setShowAdd(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Aggiungi cliente
        </button>
      </div>

      {/* Stats */}
      <div className="bs-stats-grid">
        <div className="bs-stat-card">
          <div className="bs-stat-value">{total}</div>
          <div className="bs-stat-label">Clienti totali</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-value">{contacts.filter(c => c.tags.length > 0).length}</div>
          <div className="bs-stat-label">Con tag</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-value">{contacts.filter(c => c.email).length}</div>
          <div className="bs-stat-label">Con email</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-value">{contacts.filter(c => c.phone).length}</div>
          <div className="bs-stat-label">Con telefono</div>
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
              placeholder="Cerca per nome, email o telefono..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--bs-line)', fontSize: 12.5, color: 'var(--bs-text-muted)' }}>
          {loading ? 'Caricamento...' : `${filtered.length} clienti trovati`}
        </div>

        {!loading && filtered.map(c => (
          <div key={c.id} className="bs-list-row" onClick={() => setSelected(c)}>
            <div className="bs-avatar">{initials(c)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{fullName(c)}</div>
              <div style={{ fontSize: 12, color: 'var(--bs-text-muted)' }}>{c.email || c.phone || '—'}</div>
            </div>
            {c.tags.slice(0, 2).map(t => (
              <span key={t} style={{ padding: '2px 9px', background: 'var(--bs-bg)', border: '1px solid var(--bs-line)', borderRadius: 100, fontSize: 11.5, color: 'var(--bs-text-muted)', whiteSpace: 'nowrap' }}>{t}</span>
            ))}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--bs-text-faint)" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        ))}
      </div>

      {selected && <CustomerPanel contact={selected} onClose={() => setSelected(null)} />}
      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} onAdded={() => setRefreshKey(k => k + 1)} />}
    </div>
  )
}
