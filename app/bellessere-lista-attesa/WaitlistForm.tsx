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

export default function WaitlistForm({ services, operators }: { services: WlService[]; operators: WlOperator[] }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', email: '',
    calendarId: '', operatorId: '', preferredDate: '',
    timePref: 'any', preferredFrom: '', preferredTo: '', note: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const selectedService = services.find(s => s.id === form.calendarId)
  const serviceOps = useMemo(() => {
    if (!selectedService) return []
    const ids = new Set(selectedService.teamMembers)
    return operators.filter(o => ids.has(o.id))
  }, [selectedService, operators])

  // Group services for the <optgroup>s
  const grouped = useMemo(() => {
    const m = new Map<string, WlService[]>()
    for (const s of services) { if (!m.has(s.groupName)) m.set(s.groupName, []); m.get(s.groupName)!.push(s) }
    return [...m.entries()]
  }, [services])

  const today = new Date().toISOString().slice(0, 10)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName.trim()) { setError('Inserisci il tuo nome'); return }
    if (!form.phone.trim() && !form.email.trim()) { setError('Inserisci telefono o email'); return }
    if (!form.calendarId) { setError('Scegli un servizio'); return }
    if (!form.preferredDate) { setError('Scegli un giorno preferito'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/bellessere/waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, serviceName: selectedService?.name ?? '' }),
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
          Ti avviseremo via messaggio appena si libera un posto per <strong>{selectedService?.name}</strong> nel giorno scelto. A presto da Bellessere.
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
          <select style={field} value={form.calendarId} onChange={e => { set('calendarId', e.target.value); set('operatorId', '') }} required>
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
            <select style={field} value={form.operatorId} onChange={e => set('operatorId', e.target.value)}>
              <option value="">Qualsiasi operatore</option>
              {serviceOps.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label style={label}>Giorno preferito *</label>
          <input style={field} type="date" min={today} value={form.preferredDate} onChange={e => set('preferredDate', e.target.value)} required />
        </div>

        <div>
          <label style={label}>Fascia oraria</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { k: 'any', l: 'Qualsiasi' },
              { k: 'morning', l: 'Mattina' },
              { k: 'afternoon', l: 'Pomeriggio' },
              { k: 'specific', l: 'Orario preciso' },
            ].map(o => (
              <button type="button" key={o.k} onClick={() => set('timePref', o.k)} style={{
                padding: '8px 14px', borderRadius: 100, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${form.timePref === o.k ? '#0B0907' : '#C4CCD8'}`,
                background: form.timePref === o.k ? '#0B0907' : 'transparent',
                color: form.timePref === o.k ? '#fff' : '#5F6876', fontWeight: form.timePref === o.k ? 700 : 500,
              }}>{o.l}</button>
            ))}
          </div>
          {form.timePref === 'specific' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
              <input style={field} type="time" value={form.preferredFrom} onChange={e => set('preferredFrom', e.target.value)} />
              <span style={{ color: '#8C96A6' }}>→</span>
              <input style={field} type="time" value={form.preferredTo} onChange={e => set('preferredTo', e.target.value)} />
            </div>
          )}
        </div>

        <div style={{ height: 1, background: '#DDE3EC', margin: '2px 0' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={label}>Nome *</label>
            <input style={field} value={form.firstName} onChange={e => set('firstName', e.target.value)} required />
          </div>
          <div>
            <label style={label}>Cognome</label>
            <input style={field} value={form.lastName} onChange={e => set('lastName', e.target.value)} />
          </div>
          <div>
            <label style={label}>Telefono *</label>
            <input style={field} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+39..." />
          </div>
          <div>
            <label style={label}>Email</label>
            <input style={field} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
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
