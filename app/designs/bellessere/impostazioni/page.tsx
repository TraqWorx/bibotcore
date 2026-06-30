'use client'

import { useState, useEffect } from 'react'

interface GhlUser { id: string; name: string; email: string }

export default function ImpostazioniPage() {
  const [users, setUsers] = useState<GhlUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/bellessere/services')
      .then(r => r.json())
      .then(d => setUsers(d.users ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <div className="bs-page-eyebrow">Bibot</div>
        <h1 className="bs-page-title">Impostazioni</h1>
      </div>

      {/* Team */}
      <div className="bs-card">
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bs-line)', fontWeight: 700, fontSize: 14 }}>
          Team ({users.length})
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--bs-text-faint)' }}>Caricamento...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--bs-text-faint)' }}>Nessun membro del team trovato</div>
        ) : (
          users.map((u, idx) => (
            <div key={u.id} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: idx < users.length - 1 ? '1px solid var(--bs-line)' : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bs-gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: 'var(--bs-gold)', flexShrink: 0 }}>
                {u.name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.name}</div>
                <div style={{ fontSize: 12, color: 'var(--bs-text-muted)' }}>{u.email}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Note */}
      <div style={{ padding: '14px 20px', borderRadius: 10, background: 'var(--bs-gold-tint)', border: '1px solid var(--bs-line)', fontSize: 13, color: 'var(--bs-text-muted)', lineHeight: 1.6 }}>
        Gli orari di disponibilità di ogni professionista si configurano direttamente nel profilo utente su GoHighLevel.
        Le prenotazioni rispettano automaticamente quegli orari.
      </div>
    </div>
  )
}
