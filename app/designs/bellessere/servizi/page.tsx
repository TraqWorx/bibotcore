'use client'

import { useState, useEffect } from 'react'

const CATEGORIES = ['Uomo', 'Donna', 'Benessere', 'Altro']

interface GhlUser { id: string; name: string; email: string }
interface CalendarService {
  id: string
  name: string
  description?: string
  slotDuration?: number
  isActive?: boolean
  price?: number
  teamMembers?: { userId: string }[]
}

interface ParsedService extends CalendarService {
  category: string
  cleanDescription: string
}

function parseDescription(raw?: string): { category: string; cleanDescription: string } {
  if (!raw) return { category: 'Altro', cleanDescription: '' }
  const stripped = raw.replace(/<[^>]*>/g, '').trim()
  const newlineIdx = stripped.indexOf('\n')
  if (stripped.startsWith('category:')) {
    const cat = stripped.slice(9, newlineIdx !== -1 ? newlineIdx : undefined).trim()
    const desc = newlineIdx !== -1 ? stripped.slice(newlineIdx + 1).trim() : ''
    return { category: CATEGORIES.includes(cat) ? cat : 'Altro', cleanDescription: desc }
  }
  return { category: 'Altro', cleanDescription: stripped }
}

function buildDescription(category: string, description: string): string {
  return `category:${category}\n${description}`.trim()
}

function ServiceCard({
  svc, users, onEdit, onDelete,
}: { svc: ParsedService; users: GhlUser[]; onEdit: (s: CalendarService) => void; onDelete: (id: string) => void }) {
  const memberNames = (svc.teamMembers ?? [])
    .map(m => users.find(u => u.id === m.userId)?.name)
    .filter(Boolean) as string[]

  return (
    <div className="bs-service-card">
      <div className="bs-service-img">
        <div className="bs-service-img-icon">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/>
            <line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        </div>
        {svc.isActive !== false && <span className="bs-service-active-badge">Attivo</span>}
        <div style={{
          position: 'absolute', bottom: 10, left: 10,
          background: 'rgba(201,168,76,0.9)', color: '#0A0A0A',
          fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 100,
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          {svc.category}
        </div>
      </div>
      <div className="bs-service-body">
        <div className="bs-service-name">{svc.name}</div>
        {svc.cleanDescription && (
          <div className="bs-service-desc">{svc.cleanDescription}</div>
        )}
        {memberNames.length > 0 && (
          <div className="bs-service-members">{memberNames.join(' · ')}</div>
        )}
        <div className="bs-service-meta">
          <span className="bs-service-duration">{svc.slotDuration ? `${svc.slotDuration} min` : '—'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {svc.price != null && <span className="bs-service-price">€{svc.price}</span>}
            <div className="bs-service-actions">
              <button className="bs-icon-btn" onClick={() => onEdit(svc)} title="Modifica">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button className="bs-icon-btn danger" onClick={() => onDelete(svc.id)} title="Elimina">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ServiceModal({
  service, users, onClose, onSaved,
}: { service: CalendarService | null; users: GhlUser[]; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!service
  const parsed = parseDescription(service?.description)
  const [form, setForm] = useState({
    name: service?.name ?? '',
    category: parsed.category,
    description: parsed.cleanDescription,
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
        description: buildDescription(form.category, form.description),
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
            {error && (
              <div style={{ padding: '10px 14px', background: '#FEF2F2', color: '#DC2626', borderRadius: 9, fontSize: 13 }}>{error}</div>
            )}
            <div>
              <label className="bs-field-label">Categoria *</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, category: cat }))}
                    style={{
                      padding: '7px 18px',
                      borderRadius: 9,
                      border: `1.5px solid ${form.category === cat ? 'var(--bs-gold)' : 'var(--bs-line)'}`,
                      background: form.category === cat ? 'var(--bs-gold-tint)' : 'white',
                      color: form.category === cat ? 'var(--bs-gold)' : 'var(--bs-text-muted)',
                      fontWeight: form.category === cat ? 700 : 500,
                      fontSize: 13,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
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
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5, padding: '8px 12px', borderRadius: 9, border: `1.5px solid ${form.teamMembers.includes(u.id) ? 'var(--bs-gold)' : 'var(--bs-line)'}`, background: form.teamMembers.includes(u.id) ? 'var(--bs-gold-tint)' : 'white', transition: 'all 0.15s' }}>
                      <input
                        type="checkbox"
                        checked={form.teamMembers.includes(u.id)}
                        onChange={() => toggleMember(u.id)}
                        style={{ width: 16, height: 16, accentColor: 'var(--bs-gold)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600 }}>{u.name}</span>
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
  const [services, setServices] = useState<ParsedService[]>([])
  const [users, setUsers] = useState<GhlUser[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('Tutti')
  const [editTarget, setEditTarget] = useState<CalendarService | null | 'new'>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch('/api/bellessere/services')
      .then(r => r.json())
      .then(d => {
        const parsed: ParsedService[] = (d.calendars ?? []).map((svc: CalendarService) => ({
          ...svc,
          ...parseDescription(svc.description),
        }))
        setServices(parsed)
        setUsers(d.users ?? [])
      })
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

  const allCategories = ['Tutti', ...CATEGORIES.filter(c => services.some(s => s.category === c))]
  const filtered = activeCategory === 'Tutti' ? services : services.filter(s => s.category === activeCategory)

  const grouped = CATEGORIES.reduce<Record<string, ParsedService[]>>((acc, cat) => {
    const items = filtered.filter(s => s.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})
  const ungrouped = filtered.filter(s => !CATEGORIES.includes(s.category))
  if (ungrouped.length) grouped['Altro'] = ungrouped

  const avgPrice = services.filter(s => s.price != null).length > 0
    ? Math.round(services.reduce((acc, s) => acc + (s.price ?? 0), 0) / services.filter(s => s.price != null).length)
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="bs-page-eyebrow">Gestione</div>
          <h1 className="bs-page-title">Servizi</h1>
        </div>
        <button className="bs-btn-primary" onClick={() => setEditTarget('new')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Aggiungi servizio
        </button>
      </div>

      <div className="bs-stats-grid">
        <div className="bs-stat-card">
          <div className="bs-stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          </div>
          <div className="bs-stat-value">{services.length}</div>
          <div className="bs-stat-label">Servizi totali</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
          </div>
          <div className="bs-stat-value">{users.length}</div>
          <div className="bs-stat-label">Barbieri</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div className="bs-stat-value">{avgPrice > 0 ? `€${avgPrice}` : '—'}</div>
          <div className="bs-stat-label">Prezzo medio</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <div className="bs-stat-value">{allCategories.length - 1}</div>
          <div className="bs-stat-label">Categorie</div>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8 }}>
        {allCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '8px 20px',
              borderRadius: 10,
              border: `1.5px solid ${activeCategory === cat ? 'var(--bs-black)' : 'var(--bs-line)'}`,
              background: activeCategory === cat ? 'var(--bs-black)' : 'white',
              color: activeCategory === cat ? 'white' : 'var(--bs-text-muted)',
              fontWeight: activeCategory === cat ? 700 : 500,
              fontSize: 13.5,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {cat}
            <span style={{ marginLeft: 6, opacity: 0.6, fontSize: 12 }}>
              {cat === 'Tutti' ? services.length : services.filter(s => s.category === cat).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--bs-text-faint)' }}>Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--bs-text-faint)', fontSize: 13 }}>
          Nessun servizio. Creane uno!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--bs-text-muted)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 20, height: 2, background: 'var(--bs-gold)', borderRadius: 2 }} />
                {cat}
              </div>
              <div className="bs-services-grid">
                {items.map(svc => (
                  <ServiceCard key={svc.id} svc={svc} users={users} onEdit={s => setEditTarget(s)} onDelete={deleteService} />
                ))}
              </div>
            </div>
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
