'use client'

import { useState } from 'react'

export default function LeadForm({ slug }: { slug: string }) {
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 44,
    padding: '0 14px',
    border: '1px solid #c8d4e3',
    borderRadius: 10,
    background: 'white',
    fontSize: 15,
    color: '#102236',
    outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#5b6b7d', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, display: 'block',
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const fd = new FormData(e.currentTarget)
    const body = {
      storeSlug: slug,
      firstName: fd.get('firstName') as string,
      lastName: fd.get('lastName') as string,
      email: fd.get('email') as string,
      phone: fd.get('phone') as string,
      city: fd.get('city') as string,
      notes: fd.get('notes') as string,
      honeypot: fd.get('website') as string, // bot trap
    }
    try {
      const r = await fetch('/api/apulia/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError((j as { error?: string }).error || `Errore ${r.status}`)
      } else {
        setDone(true)
      }
    } catch {
      setError('Connessione assente, riprova.')
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 12px' }}>
        <div style={{ fontSize: 48 }}>✓</div>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1ea975', marginTop: 8 }}>Grazie!</h3>
        <p style={{ fontSize: 14, color: '#5b6b7d', marginTop: 8 }}>
          Abbiamo ricevuto la tua richiesta. Ti contatteremo presto.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Honeypot */}
      <input name="website" type="text" tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: -10000, opacity: 0, height: 0, width: 0 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Nome *</label>
          <input name="firstName" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Cognome</label>
          <input name="lastName" style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Email *</label>
        <input name="email" type="email" required style={inputStyle} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Telefono</label>
          <input name="phone" type="tel" placeholder="+39…" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Città</label>
          <input name="city" style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Messaggio</label>
        <textarea name="notes" rows={3} style={{ ...inputStyle, height: 'auto', padding: 12, resize: 'vertical' }} placeholder="Es: bolletta da analizzare, orari preferiti, …"></textarea>
      </div>
      {error && <div style={{ fontSize: 13, color: '#d6453d', padding: 10, background: '#fdecea', borderRadius: 8 }}>{error}</div>}
      <button
        type="submit"
        disabled={pending}
        style={{
          height: 48,
          background: 'linear-gradient(135deg, #2f7dc1 0%, #2bb6e6 100%)',
          color: 'white',
          border: 'none',
          borderRadius: 10,
          fontSize: 15,
          fontWeight: 700,
          cursor: pending ? 'wait' : 'pointer',
          marginTop: 4,
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? 'Invio…' : 'Invia richiesta'}
      </button>
    </form>
  )
}
