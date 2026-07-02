'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

interface WaitEntry {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
  calendar_id: string
  service_name: string | null
  operator_id: string | null
  preferred_date: string
  time_pref: string
  preferred_from: string | null
  preferred_to: string | null
  status: string
  invited_at: string | null
  hold_until: string | null
  notified_count: number
  created_at: string
}

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  waiting: { label: 'In attesa', bg: 'rgba(210,171,75,0.16)', color: '#8a6d1f' },
  invited: { label: 'Invitato', bg: 'rgba(99,102,241,0.14)', color: '#4338CA' },
  booked: { label: 'Prenotato', bg: 'rgba(16,185,129,0.14)', color: '#065F46' },
  expired: { label: 'Scaduto', bg: 'rgba(107,114,128,0.14)', color: '#374151' },
  cancelled: { label: 'Annullato', bg: 'rgba(239,68,68,0.12)', color: '#B91C1C' },
}
const TIME_PREF: Record<string, string> = { any: 'Qualsiasi orario', morning: 'Mattina', afternoon: 'Pomeriggio', specific: 'Orario preciso' }

function initials(n: string) { return n.split(' ').map(p => p[0] ?? '').join('').toUpperCase().slice(0, 2) || '?' }

export default function ListaAttesaPage() {
  const [entries, setEntries] = useState<WaitEntry[]>([])
  const [users, setUsers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'waiting' | 'invited' | 'booked'>('all')
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')

  const load = useCallback(() => {
    return fetch('/api/bellessere/waitlist').then(r => r.json())
      .then(d => setEntries(d.entries ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      load(),
      fetch('/api/bellessere/services').then(r => r.json()).then(d => {
        setUsers(Object.fromEntries((d.users ?? []).map((u: { id: string; name: string }) => [u.id, u.name])))
      }).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [load])

  async function invite(id: string) {
    setBusy(p => ({ ...p, [id]: true })); setError('')
    try {
      const res = await fetch('/api/bellessere/waitlist', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error ?? 'Errore invio'); return }
      await load()
    } finally { setBusy(p => ({ ...p, [id]: false })) }
  }

  async function remove(id: string) {
    if (!confirm('Rimuovere questa persona dalla lista d\'attesa?')) return
    setBusy(p => ({ ...p, [id]: true })); setError('')
    try {
      const res = await fetch('/api/bellessere/waitlist', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (res.ok) setEntries(prev => prev.filter(e => e.id !== id))
    } finally { setBusy(p => ({ ...p, [id]: false })) }
  }

  const counts = useMemo(() => ({
    waiting: entries.filter(e => e.status === 'waiting').length,
    invited: entries.filter(e => e.status === 'invited').length,
    booked: entries.filter(e => e.status === 'booked').length,
  }), [entries])

  const filtered = filter === 'all' ? entries : entries.filter(e => e.status === filter)

  const holdLabel = (e: WaitEntry) => {
    if (e.status !== 'invited' || !e.hold_until) return null
    const ms = new Date(e.hold_until).getTime() - Date.now()
    if (ms <= 0) return 'scaduto'
    const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div className="bs-page-stack">
      <div className="bs-page-header">
        <div className="bs-page-header-start">
          <div className="bs-page-eyebrow">Gestione</div>
          <h1 className="bs-page-title">Lista d&apos;attesa</h1>
          <div className="bs-page-subtitle">Clienti in attesa di un posto. Quando un appuntamento viene cancellato, il primo compatibile viene invitato in automatico.</div>
        </div>
      </div>

      {error && <div style={{ padding: '10px 14px', background: '#FEF2F2', color: '#DC2626', borderRadius: 9, fontSize: 13 }}>{error}</div>}

      <div className="bs-stats-grid">
        {[
          { value: counts.waiting, label: 'In attesa', color: 'var(--bs-text)' },
          { value: counts.invited, label: 'Invitati', color: 'var(--bs-text)' },
          { value: counts.booked, label: 'Prenotati', color: 'var(--bs-success)' },
        ].map(s => (
          <div key={s.label} className="bs-stat-card">
            <div className="bs-stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="bs-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bs-card">
        <div className="bs-filter-bar">
          <div className="bs-filter-tabs" style={{ marginLeft: 'auto' }}>
            {(['all', 'waiting', 'invited', 'booked'] as const).map(k => (
              <button key={k} className="bs-filter-tab" data-active={filter === k ? 'true' : 'false'} onClick={() => setFilter(k)}>
                {k === 'all' ? 'Tutti' : STATUS[k].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bs-loading-state">Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div className="bs-empty-state">Nessuno in lista d&apos;attesa.</div>
      ) : (
        <div className="bs-card">
          {filtered.map((e, i) => {
            const name = `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim() || 'Cliente'
            const st = STATUS[e.status] ?? STATUS.waiting
            const dateLabel = new Date(e.preferred_date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
            const timeLabel = e.time_pref === 'specific' && e.preferred_from
              ? `${e.preferred_from.slice(0, 5)}–${(e.preferred_to ?? '').slice(0, 5)}`
              : TIME_PREF[e.time_pref] ?? ''
            const hold = holdLabel(e)
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--bs-line)' : 'none' }}>
                <div className="bs-avatar" style={{ flexShrink: 0 }}>{initials(name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{name}</div>
                  <div style={{ fontSize: 12, color: 'var(--bs-text-faint)', marginTop: 1, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {e.phone && <span>{e.phone}</span>}
                    {e.email && <span>{e.email}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--bs-text-muted)', marginTop: 2 }}>
                    {e.service_name ?? 'Servizio'} · {dateLabel} · {timeLabel}
                    {e.operator_id ? ` · ${users[e.operator_id] ?? 'operatore'}` : ' · qualsiasi operatore'}
                  </div>
                </div>
                <span className="bs-badge" style={{ background: st.bg, color: st.color, flexShrink: 0 }}>
                  {st.label}{hold ? ` · ${hold}` : ''}
                </span>
                {(e.status === 'waiting' || e.status === 'invited' || e.status === 'expired') && (
                  <button className="bs-btn-primary" style={{ fontSize: 12.5, flexShrink: 0 }} disabled={busy[e.id]} onClick={() => invite(e.id)}>
                    {busy[e.id] ? '...' : e.status === 'invited' ? 'Re-invita' : 'Invita'}
                  </button>
                )}
                <button className="bs-btn-ghost" style={{ fontSize: 12.5, flexShrink: 0 }} disabled={busy[e.id]} onClick={() => remove(e.id)} title="Rimuovi">
                  Rimuovi
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
