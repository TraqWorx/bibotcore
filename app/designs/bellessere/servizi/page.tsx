'use client'

import { useState, useEffect, useMemo } from 'react'

interface GhlUser { id: string; name: string; email: string }
interface CalendarService {
  id: string
  name: string
  description?: string
  slotDuration?: number
  eventColor?: string
  isActive?: boolean
  price?: number
  teamMembers?: { userId: string }[]
}

function ServiceCard({
  svc,
  users,
  onEdit,
  onDelete,
}: {
  svc: CalendarService
  users: GhlUser[]
  onEdit: (s: CalendarService) => void
  onDelete: (id: string) => void
}) {
  const memberNames = (svc.teamMembers ?? [])
    .map(m => users.find(u => u.id === m.userId)?.name ?? m.userId)
    .filter(Boolean)

  return (
    <div className="bs-service-card">
      <div className="bs-service-img">
        <div className="bs-service-img-placeholder">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
        {svc.isActive !== false && <span className="bs-service-active-badge">Attivo</span>}
      </div>
      <div className="bs-service-body">
        <div className="bs-service-name">{svc.name}</div>
        {svc.description && <div className="bs-service-desc">{svc.description}</div>}
        {memberNames.length > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--bs-text-muted)', marginBottom: 8 }}>
            {memberNames.join(', ')}
          </div>
        )}
        <div className="bs-service-meta">
          <span className="bs-service-duration">
            {svc.slotDuration ? `${svc.slotDuration} min` : '—'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {svc.price != null && <span style={{ fontWeight: 700 }}>€{svc.price}</span>}
            <button
              onClick={() => onEdit(svc)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bs-text-faint)', padding: 4 }}
              title="Modifica"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              onClick={() => onDelete(svc.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bs-danger)', padding: 4 }}
              title="Elimina"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ServiceModal({
  service,
  users,
  onClose,
  onSaved,
}: {
  service: CalendarService | null
  users: GhlUser[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!service
  const [form, setForm] = useState({
    name: service?.name ?? '',
    description: service?.description ?? '',
    duration: String(service?.slotDuration ?? 30),
    price: service?.price != null ? String(service.price) : '',
    teamMembers: (service?.teamMembers ?? []).map(m => m.userId),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        description: form.description,
        duration: Number(form.duration),
        price: form.price ? Number(form.price) : undefined,
        teamMembers: form.teamMembers,
        ...(isEdit ? { calendarId: service!.id } : {}),
      }
      const res = await fetch('/api/bellessere/services', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const d = await res.json(); setError(d.message ?? d.error ?? 'Errore'); return }
      onSaved()
      onClose()
    } catch { setError('Errore di rete') } finally { setSaving(false) }
  }

  function toggleMember(id: string) {
    setForm(p => ({
      ...p,
      teamMembers: p.teamMembers.includes(id)
        ? p.teamMembers.filter(m => m !== id)
        : [...p.teamMembers, id],
    }))
  }

  return (
    <div className="bs-modal-overlay" onClick={onClose}>
      <div className="bs-modal" onClick={ev => ev.stopPropagation()}>
        <div className="bs-modal-header">
          <span className="bs-modal-title">{isEdit ? 'Modifica servizio' : 'Nuovo servizio'}</span>
          <button className="bs-panel-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="bs-modal-body">
            {error && <div style={{ padding: '10px 12px', background: '#FEF2F2', color: '#DC2626', borderRadius: 8, fontSize: 13 }}>{error}</div>}
            <div>
              <label className="bs-field-label">Nome servizio *</label>
              <input className="bs-input" value={form.name} required onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Es. Taglio classico" />
            </div>
            <div>
              <label className="bs-field-label">Descrizione</label>
              <input className="bs-input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Breve descrizione del servizio" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="bs-field-label">Durata (minuti) *</label>
                <input className="bs-input" type="number" min="5" max="480" value={form.duration} required onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} placeholder="30" />
              </div>
              <div>
                <label className="bs-field-label">Prezzo (€)</label>
                <input className="bs-input" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="25.00" />
              </div>
            </div>
            {users.length > 0 && (
              <div>
                <label className="bs-field-label">Chi offre questo servizio</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {users.map(u => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5 }}>
                      <input
                        type="checkbox"
                        checked={form.teamMembers.includes(u.id)}
                        onChange={() => toggleMember(u.id)}
                        style={{ width: 16, height: 16, accentColor: 'var(--bs-gold)' }}
                      />
                      <div>
                        <span style={{ fontWeight: 500 }}>{u.name}</span>
                        {u.email && <span style={{ color: 'var(--bs-text-faint)', fontSize: 12, marginLeft: 6 }}>{u.email}</span>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="bs-modal-footer">
            <button type="button" className="bs-btn-ghost" onClick={onClose}>Annulla</button>
            <button type="submit" className="bs-btn-primary" disabled={saving}>
              {saving ? 'Salvataggio...' : isEdit ? 'Salva modifiche' : 'Crea servizio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ServiziPage() {
  const [services, setServices] = useState<CalendarService[]>([])
  const [users, setUsers] = useState<GhlUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState<CalendarService | null | 'new'>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch('/api/bellessere/services')
      .then(r => r.json())
      .then(d => { setServices(d.calendars ?? []); setUsers(d.users ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [refreshKey])

  async function deleteService(id: string) {
    if (!confirm('Eliminare questo servizio?')) return
    await fetch('/api/bellessere/services', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarId: id }),
    })
    setRefreshKey(k => k + 1)
  }

  const filtered = useMemo(() => {
    if (!search) return services
    const s = search.toLowerCase()
    return services.filter(sv => sv.name.toLowerCase().includes(s) || (sv.description ?? '').toLowerCase().includes(s))
  }, [services, search])

  const active = services.filter(s => s.isActive !== false).length
  const avgPrice = services.filter(s => s.price != null).length > 0
    ? Math.round(services.filter(s => s.price != null).reduce((acc, s) => acc + (s.price ?? 0), 0) / services.filter(s => s.price != null).length)
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="bs-page-eyebrow">Gestione</div>
          <h1 className="bs-page-title">Servizi</h1>
        </div>
        <button className="bs-btn-primary" onClick={() => setEditTarget('new')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Aggiungi servizio
        </button>
      </div>

      {/* Stats */}
      <div className="bs-stats-grid">
        <div className="bs-stat-card">
          <div className="bs-stat-value">{services.length}</div>
          <div className="bs-stat-label">Servizi totali</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-value">{active}</div>
          <div className="bs-stat-label">Attivi</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-value">{users.length}</div>
          <div className="bs-stat-label">Barbieri</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-value">{avgPrice > 0 ? `€${avgPrice}` : '—'}</div>
          <div className="bs-stat-label">Prezzo medio</div>
        </div>
      </div>

      {/* Search */}
      <div className="bs-card" style={{ padding: 0 }}>
        <div className="bs-filter-bar">
          <div className="bs-search-wrap">
            <svg className="bs-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="bs-search-input"
              placeholder="Cerca servizi..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--bs-text-faint)' }}>Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--bs-text-faint)', fontSize: 13 }}>
          {search ? 'Nessun servizio trovato.' : 'Nessun servizio ancora. Creane uno!'}
        </div>
      ) : (
        <div className="bs-services-grid">
          {filtered.map(svc => (
            <ServiceCard
              key={svc.id}
              svc={svc}
              users={users}
              onEdit={s => setEditTarget(s)}
              onDelete={deleteService}
            />
          ))}
        </div>
      )}

      {editTarget !== null && (
        <ServiceModal
          service={editTarget === 'new' ? null : editTarget}
          users={users}
          onClose={() => setEditTarget(null)}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  )
}
