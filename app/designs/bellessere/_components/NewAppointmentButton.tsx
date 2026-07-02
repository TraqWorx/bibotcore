'use client'

import { useState, useEffect } from 'react'
import ContactCombobox from './ContactCombobox'

interface Calendar { id: string; name: string; slotDuration?: number; isActive?: boolean; price?: number; teamMembers?: { userId: string }[] }
interface GhlUser { id: string; name: string }

export default function NewAppointmentButton() {
  const [open, setOpen] = useState(false)
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [users, setUsers] = useState<GhlUser[]>([])
  const [loaded, setLoaded] = useState(false)

  const [form, setForm] = useState({ contactId: '', calendarId: '', userId: '', date: '', slot: '', appointmentStatus: 'confirmed' })
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && !loaded) {
      fetch('/api/bellessere/services').then(r => r.json()).then(s => {
        setCalendars(s.calendars ?? [])
        setUsers((s.users ?? []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })))
        setLoaded(true)
      }).catch(() => {})
    }
  }, [open, loaded])

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
      setOpen(false)
      setForm({ contactId: '', calendarId: '', userId: '', date: '', slot: '', appointmentStatus: 'confirmed' })
      window.location.reload()
    } catch (err) { setError(err instanceof Error ? err.message : 'Errore di rete') } finally { setSaving(false) }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <button className="bs-btn-primary" onClick={() => setOpen(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nuovo appuntamento
      </button>

      {open && (
        <div className="bs-modal-overlay" onClick={() => setOpen(false)}>
          <div className="bs-modal" onClick={e => e.stopPropagation()}>
            <div className="bs-modal-header">
              <span className="bs-modal-title">Nuovo appuntamento</span>
              <button className="bs-panel-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <form onSubmit={submit}>
              <div className="bs-modal-body">
                {error && <div style={{ padding: '10px 14px', background: '#FEF2F2', color: '#DC2626', borderRadius: 9, fontSize: 13 }}>{error}</div>}
                {!loaded ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--bs-text-faint)', fontSize: 13 }}>Caricamento...</div>
                ) : (
                  <>
                    <div>
                      <label className="bs-field-label">Servizio *</label>
                      <select className="bs-select" value={form.calendarId} onChange={e => setForm(p => ({ ...p, calendarId: e.target.value }))} required>
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
                      <ContactCombobox value={form.contactId} onChange={id => setForm(p => ({ ...p, contactId: id }))} />
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
                  </>
                )}
              </div>
              <div className="bs-modal-footer">
                <button type="button" className="bs-btn-ghost" onClick={() => setOpen(false)}>Annulla</button>
                <button type="submit" className="bs-btn-primary" disabled={saving || !form.slot || !loaded}>{saving ? 'Salvataggio...' : 'Crea appuntamento'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
