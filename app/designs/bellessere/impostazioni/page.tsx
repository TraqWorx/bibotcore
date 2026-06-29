'use client'

import { useState, useEffect } from 'react'

interface GhlUser {
  id: string
  name: string
  email: string
  phone?: string
}

const DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

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

  function initials(name: string) {
    return name.split(' ').map(p => p[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
  }

  const GHL_BASE = 'https://app.gohighlevel.com'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <div className="bs-page-eyebrow">Configurazione</div>
        <h1 className="bs-page-title">Impostazioni</h1>
      </div>

      {/* Team section */}
      <div className="bs-card">
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--bs-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Team</div>
            <div style={{ fontSize: 12.5, color: 'var(--bs-text-muted)', marginTop: 2 }}>Professionisti del salone</div>
          </div>
          <a
            href={`${GHL_BASE}/settings/team-management`}
            target="_blank"
            rel="noopener noreferrer"
            className="bs-btn-ghost"
            style={{ fontSize: 12.5 }}
          >
            Gestisci in GHL
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--bs-text-faint)' }}>Caricamento...</div>
        ) : users.map((u, idx) => (
          <div key={u.id} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: idx < users.length - 1 ? '1px solid var(--bs-line)' : 'none' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--bs-gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: 'var(--bs-gold)', flexShrink: 0 }}>
              {initials(u.name)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--bs-text-muted)' }}>{u.email}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Availability section */}
      <div className="bs-card">
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--bs-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Orari di lavoro</div>
            <div style={{ fontSize: 12.5, color: 'var(--bs-text-muted)', marginTop: 2 }}>Disponibilità settimanale per prenotazioni online</div>
          </div>
          <a
            href={`${GHL_BASE}/settings/profile`}
            target="_blank"
            rel="noopener noreferrer"
            className="bs-btn-ghost"
            style={{ fontSize: 12.5 }}
          >
            Modifica in GHL
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '14px 16px', background: 'var(--bs-bg)', borderRadius: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2" style={{ marginTop: 2, flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Disponibilità gestita in GHL</div>
              <div style={{ fontSize: 12.5, color: 'var(--bs-text-muted)', lineHeight: 1.5 }}>
                Gli orari di lavoro di ogni professionista si impostano direttamente in GoHighLevel, nella sezione <strong>Impostazioni → Profilo → Disponibilità</strong>. Le modifiche vengono applicate automaticamente alle prenotazioni online.
              </div>
            </div>
          </div>

          {/* Visual weekly schedule preview */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--bs-text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11, width: 120 }}>Giorno</th>
                  {users.slice(0, 5).map(u => (
                    <th key={u.id} style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--bs-text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>
                      {u.name.split(' ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, i) => (
                  <tr key={day} style={{ borderTop: '1px solid var(--bs-line)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: i >= 5 ? 'var(--bs-text-muted)' : 'var(--bs-text)' }}>{day}</td>
                    {users.slice(0, 5).map(u => (
                      <td key={u.id} style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--bs-text-faint)' }}>—</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12, color: 'var(--bs-text-faint)', textAlign: 'center' }}>
            Gli orari effettivi si visualizzano nel calendario GHL
          </div>
        </div>
      </div>

      {/* Location info */}
      <div className="bs-card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Salone</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bs-gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--bs-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nome</div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Bellessere</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bs-gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bs-gold)" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--bs-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Location ID (GHL)</div>
              <div style={{ fontWeight: 600, fontSize: 12, fontFamily: 'monospace', color: 'var(--bs-text-muted)' }}>38lvVkcTVVRFDDcHqYd1</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
