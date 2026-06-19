'use client'

import { useState } from 'react'
import type { CategoryStat } from '@/lib/farmacia/dashboard'

type Key = 'revenueCents' | 'ordersCount' | 'repurchasePct'

function euros(c: number) { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(c / 100) }

export default function CategoryTable({ rows }: { rows: CategoryStat[] }) {
  const [sort, setSort] = useState<Key>('revenueCents')
  const sorted = [...rows].sort((a, b) => b[sort] - a[sort])

  const th = (label: string, key: Key) => (
    <th onClick={() => setSort(key)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      {label}{sort === key ? ' ↓' : ''}
    </th>
  )

  return (
    <div className="fc-card" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="fc-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Categoria</th>
            {th('Fatturato', 'revenueCents')}
            {th('Ordini', 'ordersCount')}
            {th('Riacquisto', 'repurchasePct')}
            <th>Cliente top</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && <tr><td colSpan={5} style={{ padding: 16, color: 'var(--fc-text-muted)' }}>Nessuna categoria. Aggiungi mappature SKU/EAN in Impostazioni o importa file con categoria.</td></tr>}
          {sorted.map((r) => (
            <tr key={r.category}>
              <td style={{ fontWeight: 600 }}>{r.category}</td>
              <td>{euros(r.revenueCents)}</td>
              <td>{r.ordersCount}</td>
              <td>{r.repurchasePct}%</td>
              <td style={{ fontSize: 13 }}>{r.topCustomer ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
