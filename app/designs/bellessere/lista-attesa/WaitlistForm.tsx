'use client'

import { useState, useMemo } from 'react'
import type { WlService, WlOperator } from './page'

const card: React.CSSProperties = {
  background: 'linear-gradient(180deg, #FFFFFF, #FBFCFE)',
  border: '1px solid #DDE3EC', borderRadius: 16,
  boxShadow: '0 1px 2px rgba(15,23,42,0.06), 0 12px 30px rgba(15,23,42,0.08)',
  padding: '26px 24px',
}
const label: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#5F6876', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }
const field: React.CSSProperties = { width: '100%', border: '1px solid #C4CCD8', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#121417', background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }

interface DaySlot { date: string; timePref: string; from: string; to: string }
const emptySlot = (): DaySlot => ({ date: '', timePref: 'any', from: '', to: '' })

const TIME_OPTS = [
  { k: 'any', l: 'Qualsiasi' },
  { k: 'morning', l: 'Mattina' },
  { k: 'afternoon', l: 'Pomeriggio' },
  { k: 'specific', l: 'Orario preciso' },
]

export default function WaitlistForm({ services, operators }: { services: WlService[]; operators: WlOperator[] }) {
  const [contact, setContact] = useState({ firstName: '', lastName: '', phone: '', email: '' })
  const [calendarId, setCalendarId] = useState('')
  const [operatorId, setOperatorId] = useState('')
  const [slots, setSlots] = useState<DaySlot[]>([emptySlot()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const selectedService = services.find(s => s.id === calendarId)
  const serviceOps = useMemo(() => {
    if (!selectedService) return []
    const ids = new Set(selectedService.teamMembers)
    return operators.filter(o => ids.has(o.id))
  }, [selectedService, operators])

  const grouped = useMemo(() => {
    const m = new Map<string, WlService[]>()
    for (const s of services) { if (!m.has(s.groupName)) m.set(s.groupName, []); m.get(s.groupName)!.push(s) }
    return [...m.entries()]
  }, [services])

  const today = new Date().toISOString().slice(0, 10)
  // Time options generated at the selected service's booking interval (default 15 min)
  const intervalMin = selectedService?.interval || 15
  const timeOptions = useMemo(() => {
    const opts: string[] = []
    for (let m = 7 * 60; m <= 21 * 60; m += intervalMin) {
      opts.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
    }
    return opts
  }, [intervalMin])

  const setSlot = (i: number, patch: Partial<DaySlot>) => setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  const addSlot = () => setSlots(prev => [...prev, emptySlot()])
  const removeSlot = (i: number) => setSlots(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!contact.firstName.trim()) { setError('Inserisci il tuo nome'); return }
    if (!contact.phone.trim() && !contact.email.trim()) { setError('Inserisci telefono o email'); return }
    if (!calendarId) { setError('Scegli un servizio'); return }
    const validSlots = slots.filter(s => s.date)
    if (validSlots.length === 0) { setError('Scegli almeno un giorno'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/bellessere/waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...contact, calendarId, operatorId, serviceName: selectedService?.name ?? '',
          slots: validSlots.map(s => ({ preferredDate: s.date, timePref: s.timePref, preferredFrom: s.from, preferredTo: s.to })),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error ?? 'Errore, riprova'); return }
      setDone(true)
    } catch { setError('Errore di rete, riprova') }
    finally { setSaving(false) }
  }

  if (done) {
    return (
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ width: 54, height: 54, borderRadius: '50%', margin: '4px auto 14px', background: 'rgba(16,185,129,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>Sei in lista d&apos;attesa!</div>
        <div style={{ fontSize: 14, color: '#5F6876', lineHeight: 1.6 }}>
          Ti avviseremo via messaggio appena si libera un posto per <strong>{selectedService?.name}</strong> nei giorni scelti. A presto da Bellessere.
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={card}>
      <div style={{ fontSize: 20, fontWeight: 850, marginBottom: 4 }}>Lista d&apos;attesa</div>
      <div style={{ fontSize: 13.5, color: '#5F6876', marginBottom: 20, lineHeight: 1.55 }}>
        Non trovi un orario libero? Lascia le tue preferenze: ti avviseremo appena si libera un posto.
      </div>

      {error && <div style={{ padding: '10px 14px', background: '#FEF2F2', color: '#DC2626', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={label}>Servizio *</label>
          <select style={field} value={calendarId} onChange={e => { setCalendarId(e.target.value); setOperatorId('') }} required>
            <option value="">Seleziona servizio...</option>
            {grouped.map(([g, list]) => (
              <optgroup key={g} label={g}>
                {list.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        {serviceOps.length > 0 && (
          <div>
            <label style={label}>Operatore</label>
            <select style={field} value={operatorId} onChange={e => setOperatorId(e.target.value)}>
              <option value="">Qualsiasi operatore</option>
              {serviceOps.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}

        {/* Days + per-day time preference */}
        <div>
          <label style={label}>Giorni e fasce orarie preferiti *</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {slots.map((s, i) => (
              <div key={i} style={{ border: '1px solid #DDE3EC', borderRadius: 12, padding: '12px 14px', background: '#FBFCFE' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <input style={{ ...field, flex: 1 }} type="date" min={today} value={s.date} onChange={e => setSlot(i, { date: e.target.value })} />
                  {slots.length > 1 && (
                    <button type="button" onClick={() => removeSlot(i)} title="Rimuovi giorno"
                      style={{ border: '1px solid #C4CCD8', background: '#fff', borderRadius: 9, padding: '8px 11px', cursor: 'pointer', color: '#DC2626', fontSize: 15, lineHeight: 1 }}>✕</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TIME_OPTS.map(o => (
                    <button type="button" key={o.k} onClick={() => setSlot(i, { timePref: o.k })} style={{
                      padding: '7px 12px', borderRadius: 100, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1.5px solid ${s.timePref === o.k ? '#0B0907' : '#C4CCD8'}`,
                      background: s.timePref === o.k ? '#0B0907' : 'transparent',
                      color: s.timePref === o.k ? '#fff' : '#5F6876', fontWeight: s.timePref === o.k ? 700 : 500,
                    }}>{o.l}</button>
                  ))}
                </div>
                {s.timePref === 'specific' && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
                    <select style={field} value={s.from} onChange={e => setSlot(i, { from: e.target.value })}>
                      <option value="">Dalle...</option>
                      {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span style={{ color: '#8C96A6' }}>→</span>
                    <select style={field} value={s.to} onChange={e => setSlot(i, { to: e.target.value })}>
                      <option value="">Alle...</option>
                      {timeOptions.filter(t => !s.from || t > s.from).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addSlot} style={{
            marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent',
            border: '1.5px dashed #C4CCD8', borderRadius: 10, padding: '9px 14px', cursor: 'pointer',
            color: '#5F6876', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Aggiungi un altro giorno
          </button>
        </div>

        <div style={{ height: 1, background: '#DDE3EC', margin: '2px 0' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={label}>Nome *</label>
            <input style={field} value={contact.firstName} onChange={e => setContact(p => ({ ...p, firstName: e.target.value }))} required />
          </div>
          <div>
            <label style={label}>Cognome</label>
            <input style={field} value={contact.lastName} onChange={e => setContact(p => ({ ...p, lastName: e.target.value }))} />
          </div>
          <div>
            <label style={label}>Telefono *</label>
            <input style={field} type="tel" value={contact.phone} onChange={e => setContact(p => ({ ...p, phone: e.target.value }))} placeholder="+39..." />
          </div>
          <div>
            <label style={label}>Email</label>
            <input style={field} type="email" value={contact.email} onChange={e => setContact(p => ({ ...p, email: e.target.value }))} />
          </div>
        </div>

        <button type="submit" disabled={saving} style={{
          marginTop: 6, width: '100%', padding: '13px', borderRadius: 11, border: '1px solid #0B0907',
          background: 'linear-gradient(180deg, #1A1713, #0B0907)', color: '#fff',
          fontSize: 14, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
          fontFamily: 'inherit', opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Invio...' : "Iscrivimi alla lista d'attesa"}
        </button>
      </div>
    </form>
  )
}
