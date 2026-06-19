'use client'

import { useMemo, useState } from 'react'
import { computeTier, type SegmentConfig } from '@/lib/farmacia/segments'
import ContactDrawer from './ContactDrawer'

export interface ClientiRow {
  id: string
  first_name: string | null
  last_name: string | null
  phone_norm: string | null
  email: string | null
  origin_tags: string[] | null
  tags: string[] | null
  notes: string | null
  orders_count: number
  total_spent_cents: number
  avg_order_cents: number
  is_conversion: boolean
  last_order_at: string | null
  sync_status: string
  ghl_id: string | null
}

const ORIGINS: { key: string; label: string }[] = [
  { key: 'amazon', label: 'Amazon' },
  { key: 'ebay', label: 'eBay' },
  { key: 'online_store', label: 'Sito' },
  { key: 'other', label: 'Altro' },
]

function euros(c: number) { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format((c ?? 0) / 100) }
function name(r: ClientiRow) { return [r.first_name, r.last_name].filter(Boolean).join(' ') || r.phone_norm || r.email || '—' }

export default function ClientiView({ contacts, config }: { contacts: ClientiRow[]; config: SegmentConfig }) {
  const [q, setQ] = useState('')
  const [cluster, setCluster] = useState('')
  const [origin, setOrigin] = useState('')
  const [selected, setSelected] = useState<ClientiRow | null>(null)
  const [adding, setAdding] = useState(false)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return contacts.filter((r) => {
      if (cluster && computeTier(r.orders_count, r.total_spent_cents, config)?.name !== cluster) return false
      if (origin && !(r.origin_tags ?? []).includes(origin)) return false
      if (needle) {
        const hay = `${name(r)} ${r.phone_norm ?? ''} ${r.email ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [contacts, q, cluster, origin, config])

  return (
    <div style={{ padding: 32, maxWidth: 1160 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Clienti</h1>
        <button className="fc-btn-primary" onClick={() => { setAdding(true); setSelected(null) }}>+ Nuovo cliente</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nome, telefono, email…" style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--fc-line-strong)' }} />
        <select value={cluster} onChange={(e) => setCluster(e.target.value)} style={sel}>
          <option value="">Tutte le fasce</option>
          {config.segments.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
        <select value={origin} onChange={(e) => setOrigin(e.target.value)} style={sel}>
          <option value="">Tutte le origini</option>
          {ORIGINS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      <p style={{ color: 'var(--fc-text-muted)', fontSize: 13, marginBottom: 12 }}>{filtered.length} clienti</p>

      <div className="fc-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="fc-table" style={{ width: '100%' }}>
          <thead><tr><th>Cliente</th><th>LTV</th><th>Ordini</th><th>Fascia</th><th>Origine</th><th>Ultimo ordine</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 16, color: 'var(--fc-text-muted)' }}>Nessun cliente.</td></tr>}
            {filtered.map((r) => {
              const tier = computeTier(r.orders_count, r.total_spent_cents, config)
              return (
                <tr key={r.id} onClick={() => { setSelected(r); setAdding(false) }} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{name(r)}</td>
                  <td>{euros(r.total_spent_cents)}</td>
                  <td>{r.orders_count}</td>
                  <td>{tier ? <span className="fc-pill" data-tone={tier.color ?? 'gray'}>{tier.name}</span> : '—'}</td>
                  <td style={{ fontSize: 12 }}>{(r.origin_tags ?? []).join(', ') || '—'}</td>
                  <td style={{ fontSize: 13 }}>{r.last_order_at ? new Date(r.last_order_at).toLocaleDateString('it-IT') : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {(selected || adding) && (
        <ContactDrawer
          contact={selected}
          adding={adding}
          config={config}
          onClose={() => { setSelected(null); setAdding(false) }}
        />
      )}
    </div>
  )
}

const sel: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--fc-line-strong)', background: 'var(--fc-surface)' }
