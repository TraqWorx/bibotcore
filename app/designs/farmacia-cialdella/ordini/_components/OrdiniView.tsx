'use client'

import { useMemo, useState } from 'react'
import OrderDrawer from './OrderDrawer'

export interface OrderRow {
  id: string
  order_ext_id: string
  channel: string
  order_date: string | null
  total_cents: number | null
  category: string | null
  status: string | null
  contact_id: string | null
  ship_name: string | null
  ship_address: string | null
  ship_city: string | null
  ship_zip: string | null
  ship_province: string | null
  ship_country: string | null
  farmacia_contacts: { first_name: string | null; last_name: string | null; phone_norm: string | null } | null
}

function euros(c: number | null) { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format((c ?? 0) / 100) }
export function customerName(o: OrderRow) { return [o.farmacia_contacts?.first_name, o.farmacia_contacts?.last_name].filter(Boolean).join(' ') || o.farmacia_contacts?.phone_norm || '—' }

export default function OrdiniView({ orders }: { orders: OrderRow[] }) {
  const [q, setQ] = useState('')
  const [origin, setOrigin] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [sel, setSel] = useState<OrderRow | null>(null)

  const origins = useMemo(() => [...new Set(orders.map((o) => o.channel).filter(Boolean))], [orders])
  const statuses = useMemo(() => [...new Set(orders.map((o) => o.status).filter((s): s is string => !!s))], [orders])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const minC = min ? Math.round(Number(min) * 100) : null
    const maxC = max ? Math.round(Number(max) * 100) : null
    return orders.filter((o) => {
      if (origin && o.channel !== origin) return false
      if (status && o.status !== status) return false
      if (from && (!o.order_date || o.order_date < from)) return false
      if (to && (!o.order_date || o.order_date > to + 'T23:59:59')) return false
      if (minC != null && (o.total_cents ?? 0) < minC) return false
      if (maxC != null && (o.total_cents ?? 0) > maxC) return false
      if (needle && !`${customerName(o)} ${o.order_ext_id}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [orders, q, origin, status, from, to, min, max])

  return (
    <div style={{ padding: 32, maxWidth: 1160 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Ordini</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente o n. ordine…" style={{ ...inp, flex: 1, minWidth: 180 }} />
        <select value={origin} onChange={(e) => setOrigin(e.target.value)} style={inp}><option value="">Origine</option>{origins.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={inp}><option value="">Stato</option>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <label style={lbl}>Dal</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inp} />
        <label style={lbl}>Al</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inp} />
        <label style={lbl}>Importo €</label>
        <input type="number" value={min} onChange={(e) => setMin(e.target.value)} placeholder="min" style={{ ...inp, width: 90 }} />
        <input type="number" value={max} onChange={(e) => setMax(e.target.value)} placeholder="max" style={{ ...inp, width: 90 }} />
      </div>

      <p style={{ color: 'var(--fc-text-muted)', fontSize: 13, marginBottom: 12 }}>{filtered.length} ordini</p>

      <div className="fc-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="fc-table" style={{ width: '100%' }}>
          <thead><tr><th>Ordine</th><th>Cliente</th><th>Origine</th><th>Categoria</th><th>Totale</th><th>Stato</th><th>Data</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 16, color: 'var(--fc-text-muted)' }}>Nessun ordine.</td></tr>}
            {filtered.map((o) => (
              <tr key={o.id} onClick={() => setSel(o)} style={{ cursor: 'pointer' }}>
                <td style={{ fontSize: 13 }}>{o.order_ext_id}</td>
                <td>{customerName(o)}</td>
                <td><span className="fc-pill" data-tone={o.channel === 'online_store' ? 'green' : o.channel === 'other' ? 'gray' : 'blue'}>{o.channel}</span></td>
                <td style={{ fontSize: 13 }}>{o.category ?? '—'}</td>
                <td>{euros(o.total_cents)}</td>
                <td style={{ fontSize: 13 }}>{o.status ?? '—'}</td>
                <td style={{ fontSize: 13 }}>{o.order_date ? new Date(o.order_date).toLocaleDateString('it-IT') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel && <OrderDrawer order={sel} onClose={() => setSel(null)} />}
    </div>
  )
}

const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--fc-line-strong)', fontSize: 14, background: 'var(--fc-surface)' }
const lbl: React.CSSProperties = { fontSize: 13, color: 'var(--fc-text-muted)' }
