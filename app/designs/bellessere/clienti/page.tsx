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

function CustomerPanel({ contact, visitCount, onClose }: { contact: Contact; visitCount: number; onClose: () => void }) {
  const [events, setEvents] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const start = new Date(); start.setMonth(start.getMonth() - 6)
    const end = new Date(); end.setMonth(end.getMonth() + 2)
    fetch(`/api/bellessere/appointments?startTime=${start.toISOString()}&endTime=${end.toISOString()}`)
      .then(r => r.json())
      .then(d => {
        setEvents((d.events ?? [])
          .filter((e: { contactId?: string }) => e.contactId === contact.id)
          .map((e: Appointment) => ({ id: e.id, title: e.title, startTime: e.startTime, appointmentStatus: e.appointmentStatus })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [contact.id])

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
      <div className="bs-panel">
        <div className="bs-panel-header">
          <span className="bs-panel-title">Dettagli cliente</span>
          <button className="bs-panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="bs-panel-body">
          {/* Avatar + name */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
            <div className="bs-avatar" style={{ width: 60, height: 60, fontSize: 20 }}>{initials(contact)}</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{fullName(contact)}</div>
              {memberSince && <div style={{ fontSize: 12, color: 'var(--bs-text-faint)', marginTop: 2 }}>Cliente dal {memberSince}</div>}
            </div>
          </div>

          {/* Contact info */}
          <div className="bs-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {contact.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bs-gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 10a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.37h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8 9a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16c.06.44.06.89 0 1.33z"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--bs-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Telefono</div>
                  <div style={{ fontSize: 13.5 }}>{contact.phone}</div>
                </div>
              </div>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--bs-line)' }}>
            {[
              { value: visitCount, label: 'Visite' },
              { value: events.filter(e => e.appointmentStatus === 'showed').length, label: 'Completati' },
              { value: events.filter(e => e.appointmentStatus === 'cancelled').length, label: 'Annullati' },
            ].map((s, i) => (
              <div key={s.label} style={{
                padding: '14px 10px', textAlign: 'center', background: 'white',
                borderRight: i < 2 ? '1px solid var(--bs-line)' : 'none',
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--bs-text)', letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontSize: 11.5, color: 'var(--bs-text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tags */}
          {contact.tags.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bs-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Tag</div>
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
                {events.slice(0, 5).map(ev => {
                  const cls = STATUS_CLS[ev.appointmentStatus ?? 'new'] ?? 'bs-badge-pending'
                  const lbl = STATUS_LBL[ev.appointmentStatus ?? 'new'] ?? 'In attesa'
                  return (
                    <div key={ev.id} style={{ padding: '10px 14px', background: 'var(--bs-bg)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bs-panel-actions">
          <a href="/designs/bellessere/appuntamenti" className="bs-btn-primary" style={{ justifyContent: 'center', width: '100%' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Prenota appuntamento
          </a>
          <a href="/designs/bellessere/conversazioni" className="bs-btn-ghost" style={{ justifyContent: 'center', width: '100%' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Invia messaggio
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

export default function ClientiPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [visitCounts, setVisitCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Contact | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    const start = new Date(); start.setMonth(start.getMonth() - 12)
    const end = new Date(); end.setMonth(end.getMonth() + 2)
    Promise.all([
      fetch(`/api/contacts?locationId=${BELLESSERE_LOCATION_ID}&pageSize=200`).then(r => r.json()),
      fetch(`/api/bellessere/appointments?startTime=${start.toISOString()}&endTime=${end.toISOString()}`).then(r => r.json()),
    ]).then(([ct, appts]) => {
      setContacts(ct.contacts ?? [])
      // count appointments per contact
      const counts: Record<string, number> = {}
      for (const e of (appts.events ?? [])) {
        if (e.contactId) counts[e.contactId] = (counts[e.contactId] ?? 0) + 1
      }
      setVisitCounts(counts)
    })
    .catch(() => {})
    .finally(() => setLoading(false))
  }, [refreshKey])

  const filtered = useMemo(() => {
    if (!search) return contacts
    const q = search.toLowerCase()
    return contacts.filter(c =>
      fullName(c).toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q)
    )
  }, [contacts, search])

  // Sort by visit count desc
  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => (visitCounts[b.id] ?? 0) - (visitCounts[a.id] ?? 0)),
    [filtered, visitCounts]
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
          const visits = visitCounts[c.id] ?? 0
          return (
            <div key={c.id} className="bs-list-row" onClick={() => setSelected(c)}>
              <div className="bs-avatar">{initials(c)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{fullName(c)}</div>
                <div style={{ fontSize: 12, color: 'var(--bs-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {c.email && (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      {c.email}
                    </>
                  )}
                </div>
              </div>
              {visits > 0 && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{visits}</div>
                  <div style={{ fontSize: 11, color: 'var(--bs-text-faint)' }}>visite</div>
                </div>
              )}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--bs-text-faint)" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          )
        })}
      </div>

      {selected && <CustomerPanel contact={selected} visitCount={visitCounts[selected.id] ?? 0} onClose={() => setSelected(null)} />}
      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} onAdded={() => setRefreshKey(k => k + 1)} />}
    </div>
  )
}
