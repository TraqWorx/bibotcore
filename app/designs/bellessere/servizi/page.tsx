'use client'

import { useState, useEffect } from 'react'

interface GhlUser { id: string; name: string; email: string }
interface GhlGroup { id: string; name: string }
interface CalendarService {
  id: string
  name: string
  description?: string
  slotDuration?: number
  slotInterval?: number
  slotBuffer?: number
  preBuffer?: number
  isActive?: boolean
  price?: number
  groupId?: string
  teamMembers?: { userId: string }[]
}

interface ParsedService extends CalendarService {
  groupName: string
  cleanDescription: string
}

function stripHtml(raw?: string): string {
  if (!raw) return ''
  return raw.replace(/<[^>]*>/g, '').trim()
}

function ServiceModal({
  service, users, groups, onClose, onSaved,
}: { service: CalendarService | null; users: GhlUser[]; groups: GhlGroup[]; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!service
  const [form, setForm] = useState({
    name: service?.name ?? '',
    groupId: service?.groupId ?? (groups[0]?.id ?? ''),
    description: stripHtml(service?.description),
    duration: String(service?.slotDuration ?? 30),
    price: service?.price != null ? String(service.price) : '',
    slotInterval: String(service?.slotInterval ?? 15),
    slotBuffer: String(service?.slotBuffer ?? 0),
    teamMembers: (service?.teamMembers ?? []).map(m => m.userId),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const payload = {
        name: form.name,
        description: form.description,
        groupId: form.groupId || undefined,
        duration: Number(form.duration),
        price: form.price !== '' ? Number(form.price) : 0,
        slotInterval: Number(form.slotInterval) || undefined,
        slotBuffer: Number(form.slotBuffer) || undefined,
        teamMembers: form.teamMembers,
        ...(isEdit ? { calendarId: service!.id } : {}),
      }
      const res = await fetch('/api/bellessere/services', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const d = await res.json(); setError(d.message ?? d.error ?? 'Errore'); return }
      onSaved(); onClose()
    } catch { setError('Errore di rete') } finally { setSaving(false) }
  }

  function toggleMember(id: string) {
    setForm(p => ({
      ...p,
      teamMembers: p.teamMembers.includes(id) ? p.teamMembers.filter(m => m !== id) : [...p.teamMembers, id],
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
            {error && <div style={{ padding: '10px 14px', background: '#FEF2F2', color: '#DC2626', borderRadius: 9, fontSize: 13 }}>{error}</div>}

            {groups.length > 0 && (
              <div>
                <label className="bs-field-label">Categoria *</label>
                <div className="bs-pill-bar">
                  {groups.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      className="bs-choice-pill"
                      data-active={form.groupId === g.id ? 'true' : 'false'}
                      onClick={() => setForm(p => ({ ...p, groupId: g.id }))}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="bs-field-label">Intervallo slot (min)</label>
                <input className="bs-input" type="number" min="5" max="480" value={form.slotInterval} onChange={e => setForm(p => ({ ...p, slotInterval: e.target.value }))} placeholder="15" />
              </div>
              <div>
                <label className="bs-field-label">Buffer post (min)</label>
                <input className="bs-input" type="number" min="0" max="480" value={form.slotBuffer} onChange={e => setForm(p => ({ ...p, slotBuffer: e.target.value }))} placeholder="0" />
              </div>
            </div>
            {users.length > 0 && (
              <div>
                <label className="bs-field-label">Chi offre questo servizio</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {users.map(u => (
                    <label key={u.id} className="bs-compact-card" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5, borderColor: form.teamMembers.includes(u.id) ? 'var(--bs-gold)' : 'var(--bs-line-strong)', background: form.teamMembers.includes(u.id) ? 'var(--bs-gold-faint)' : undefined }}>
                      <input type="checkbox" checked={form.teamMembers.includes(u.id)} onChange={() => toggleMember(u.id)} style={{ width: 16, height: 16, accentColor: 'var(--bs-gold)' }} />
                      <span style={{ fontWeight: 600 }}>{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="bs-modal-footer">
            <button type="button" className="bs-btn-ghost" onClick={onClose}>Annulla</button>
            <button type="submit" className="bs-btn-primary" disabled={saving}>{saving ? 'Salvataggio...' : isEdit ? 'Salva modifiche' : 'Crea servizio'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ServiziPage() {
  const [services, setServices] = useState<ParsedService[]>([])
  const [users, setUsers] = useState<GhlUser[]>([])
  const [groups, setGroups] = useState<GhlGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState<string>('all')
  const [editTarget, setEditTarget] = useState<CalendarService | null | 'new'>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch('/api/bellessere/services')
      .then(r => r.json())
      .then(d => {
        const grps: GhlGroup[] = d.groups ?? []
        setGroups(grps)
        setUsers(d.users ?? [])
        const grpMap: Record<string, string> = {}
        grps.forEach(g => { grpMap[g.id] = g.name })
        const parsed: ParsedService[] = (d.calendars ?? []).map((svc: CalendarService) => ({
          ...svc,
          groupName: svc.groupId ? (grpMap[svc.groupId] ?? 'Altro') : 'Altro',
          cleanDescription: stripHtml(svc.description),
        }))
        setServices(parsed)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [refreshKey])

  async function deleteService(id: string) {
    if (!confirm('Eliminare questo servizio?')) return
    const res = await fetch('/api/bellessere/services', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarId: id }),
    })
    if (!res.ok) { alert('Errore durante l\'eliminazione del servizio'); return }
    setRefreshKey(k => k + 1)
  }

  const filtered = activeGroup === 'all' ? services : services.filter(s => s.groupId === activeGroup)

  // Group by GHL group for display
  const grouped: Record<string, ParsedService[]> = {}
  for (const svc of filtered) {
    const key = svc.groupName
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(svc)
  }

  const avgPrice = services.filter(s => s.price != null).length > 0
    ? Math.round(services.reduce((acc, s) => acc + (s.price ?? 0), 0) / services.filter(s => s.price != null).length)
    : 0

  return (
    <div className="bs-page-stack">
      <div className="bs-page-header">
        <div className="bs-page-header-start">
          <div className="bs-page-eyebrow">Gestione</div>
          <h1 className="bs-page-title">Servizi</h1>
          <div className="bs-page-subtitle">Catalogo servizi con categorie, durata, prezzo e operatori assegnati.</div>
        </div>
        <div className="bs-page-actions">
        <button className="bs-btn-primary" onClick={() => setEditTarget('new')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Aggiungi servizio
        </button>
        </div>
      </div>

      {/* Stats */}
      <div className="bs-stats-grid">
        <div className="bs-stat-card">
          <div className="bs-stat-value">{services.length}</div>
          <div className="bs-stat-label">Servizi totali</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-value">{groups.length}</div>
          <div className="bs-stat-label">Categorie</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-value">{avgPrice > 0 ? `€${avgPrice}` : '—'}</div>
          <div className="bs-stat-label">Prezzo medio</div>
        </div>
      </div>

      {/* Group filter */}
      <div className="bs-pill-bar">
        <button className="bs-filter-pill" data-active={activeGroup === 'all' ? 'true' : 'false'} onClick={() => setActiveGroup('all')}>
          Tutti <span style={{ opacity: 0.6, fontSize: 12, marginLeft: 4 }}>{services.length}</span>
        </button>
        {groups.map(g => (
          <button key={g.id} className="bs-filter-pill" data-active={activeGroup === g.id ? 'true' : 'false'} onClick={() => setActiveGroup(g.id)}>
            {g.name} <span style={{ opacity: 0.6, fontSize: 12, marginLeft: 4 }}>{services.filter(s => s.groupId === g.id).length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bs-loading-state">Caricamento servizi...</div>
      ) : filtered.length === 0 ? (
        <div className="bs-empty-state">Nessun servizio trovato.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {Object.entries(grouped).map(([groupName, items]) => (
            <div key={groupName} className="bs-card bs-service-group">
              <div className="bs-service-group-header">
                <div className="bs-service-group-mark" />
                <span className="bs-service-group-title">{groupName}</span>
                <span className="bs-count-chip" style={{ marginLeft: 'auto' }}>{items.length} servizi</span>
              </div>
              {items.map((svc) => {
                const memberNames = (svc.teamMembers ?? [])
                  .map(m => users.find(u => u.id === m.userId)?.name)
                  .filter(Boolean) as string[]
                return (
                  <div key={svc.id} className="bs-service-list-row">
                    {/* Icon box */}
                    <div className="bs-service-list-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5V5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v3.5c0 .83-.67 1.5-1.5 1.5z"/>
                        <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                        <path d="M9.5 14c.83 0 1.5.67 1.5 1.5V19c0 .83-.67 1.5-1.5 1.5S8 19.83 8 19v-3.5c0-.83.67-1.5 1.5-1.5z"/>
                        <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/>
                        <path d="M14 14.5c0-.83.67-1.5 1.5-1.5H19c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3.5c-.83 0-1.5-.67-1.5-1.5z"/>
                        <path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
                        <path d="M10 9.5C10 8.67 9.33 8 8.5 8H5c-.83 0-1.5.67-1.5 1.5S4.17 11 5 11h3.5c.83 0 1.5-.67 1.5-1.5z"/>
                        <path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/>
                      </svg>
                    </div>

                    {/* Name + description + staff */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="bs-service-list-name">{svc.name}</div>
                      {svc.cleanDescription && (
                        <div className="bs-service-list-desc">{svc.cleanDescription}</div>
                      )}
                      {memberNames.length > 0 && (
                        <div className="bs-service-list-members">{memberNames.join(' · ')}</div>
                      )}
                    </div>

                    {/* Duration + price */}
                    <div className="bs-service-price-stack">
                      {svc.price != null && <div className="bs-service-price-value">€{svc.price}</div>}
                      <div className="bs-service-duration-value">{svc.slotDuration ? `${svc.slotDuration} min` : '—'}</div>
                    </div>

                    {/* Actions */}
                    <div className="bs-service-list-actions">
                      <button className="bs-icon-btn" onClick={() => setEditTarget(svc)} title="Modifica">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button className="bs-icon-btn danger" onClick={() => deleteService(svc.id)} title="Elimina">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/>
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {editTarget !== null && (
        <ServiceModal
          service={editTarget === 'new' ? null : editTarget}
          users={users}
          groups={groups}
          onClose={() => setEditTarget(null)}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  )
}
