'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getOrderItems, type OrderItem } from '../_actions'
import { customerName, type OrderRow } from './OrdiniView'

function euros(c: number | null) { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format((c ?? 0) / 100) }

export default function OrderDrawer({ order, onClose }: { order: OrderRow; onClose: () => void }) {
  const [items, setItems] = useState<OrderItem[] | null>(null)
  useEffect(() => { getOrderItems(order.id).then(setItems).catch(() => setItems([])) }, [order.id])

  const ship = [order.ship_name, order.ship_address, [order.ship_zip, order.ship_city].filter(Boolean).join(' '), [order.ship_province, order.ship_country].filter(Boolean).join(' ')].filter(Boolean)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 40 }} />
      <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(560px, 100%)', background: 'var(--fc-surface)', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)', zIndex: 50, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Ordine {order.order_ext_id}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--fc-text-muted)' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, margin: '8px 0 16px', flexWrap: 'wrap' }}>
          <span className="fc-pill" data-tone={order.channel === 'online_store' ? 'green' : 'blue'}>{order.channel}</span>
          {order.status && <span className="fc-pill" data-tone="gray">{order.status}</span>}
          <span className="fc-pill" data-tone="gray">{euros(order.total_cents)}</span>
          <span className="fc-pill" data-tone="gray">{order.order_date ? new Date(order.order_date).toLocaleDateString('it-IT') : '—'}</span>
        </div>

        <div style={{ marginBottom: 16, fontSize: 14 }}>
          Cliente:{' '}
          {order.contact_id
            ? <Link href={`/designs/farmacia-cialdella/clienti/${order.contact_id}`} style={{ color: 'var(--fc-blue)', fontWeight: 600 }}>{customerName(order)}</Link>
            : <span>{customerName(order)}</span>}
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '8px 0' }}>Prodotti</h3>
        <div className="fc-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="fc-table" style={{ width: '100%' }}>
            <thead><tr><th>Prodotto</th><th>SKU/EAN</th><th>Qtà</th><th>Prezzo</th><th>Totale</th></tr></thead>
            <tbody>
              {items === null && <tr><td colSpan={5} style={{ padding: 12, color: 'var(--fc-text-faint)' }}>Caricamento…</td></tr>}
              {items?.length === 0 && <tr><td colSpan={5} style={{ padding: 12, color: 'var(--fc-text-muted)' }}>Nessun dettaglio prodotto.</td></tr>}
              {items?.map((it) => (
                <tr key={it.id}>
                  <td style={{ fontSize: 13 }}>{it.description ?? '—'}{it.category ? <span style={{ color: 'var(--fc-text-faint)', fontSize: 11, display: 'block' }}>{it.category}</span> : null}</td>
                  <td style={{ fontSize: 12 }}>{it.sku ?? it.ean ?? '—'}</td>
                  <td>{it.qty ?? '—'}</td>
                  <td>{euros(it.unit_price_cents)}</td>
                  <td>{euros(it.line_total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '16px 0 8px' }}>Indirizzo di spedizione</h3>
        {ship.length > 0
          ? <div style={{ fontSize: 14, lineHeight: 1.5 }}>{ship.map((l, i) => <div key={i}>{l}</div>)}</div>
          : <p style={{ color: 'var(--fc-text-muted)', fontSize: 14 }}>Nessun indirizzo nel file.</p>}
      </aside>
    </>
  )
}
