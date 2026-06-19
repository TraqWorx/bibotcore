import { createAdminClient } from '@/lib/supabase-server'
import { getSegments, countByTier } from '@/lib/farmacia/segments'

export const dynamic = 'force-dynamic'

function euros(cents: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

export default async function DashboardPage() {
  const sb = createAdminClient()
  const [{ count: customers }, { count: orders }, { count: conversions }, { data: spendRows }, { data: ocRows }, segments] = await Promise.all([
    sb.from('farmacia_contacts').select('id', { count: 'exact', head: true }),
    sb.from('farmacia_orders').select('id', { count: 'exact', head: true }),
    sb.from('farmacia_contacts').select('id', { count: 'exact', head: true }).eq('is_conversion', true),
    sb.from('farmacia_orders').select('total_cents'),
    sb.from('farmacia_contacts').select('orders_count'),
    getSegments(),
  ])
  const revenue = (spendRows ?? []).reduce((s, r) => s + (r.total_cents ?? 0), 0)
  const tierCounts = countByTier((ocRows ?? []).map((r) => r.orders_count ?? 0), segments)

  const stats = [
    { label: 'Clienti', value: String(customers ?? 0), tone: 'blue' },
    { label: 'Ordini', value: String(orders ?? 0), tone: 'neutral' },
    { label: 'Conversioni', value: String(conversions ?? 0), tone: 'good' },
    { label: 'Fatturato importato', value: euros(revenue), tone: 'accent' },
  ]

  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
      <p style={{ color: 'var(--fc-text-muted)', marginBottom: 24 }}>Farmacia Cialdella — panoramica vendite.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
        {stats.map((s) => (
          <div key={s.label} className="fc-stat" data-tone={s.tone}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--fc-text)' }}>{s.value}</div>
            <div style={{ fontSize: 13, color: 'var(--fc-text-muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '32px 0 12px' }}>Livelli fedeltà</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16 }}>
        {segments.map((s) => (
          <div key={s.name} className="fc-stat" data-tone={s.color ?? 'neutral'}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--fc-text)' }}>{tierCounts[s.name] ?? 0}</div>
            <div style={{ fontSize: 13, color: 'var(--fc-text-muted)', marginTop: 4 }}>{s.name} <span style={{ color: 'var(--fc-text-faint)' }}>· da {s.minOrders} ordini</span></div>
          </div>
        ))}
      </div>

      <p style={{ color: 'var(--fc-text-faint)', fontSize: 13, marginTop: 24 }}>
        Le soglie dei livelli si modificano in{' '}
        <a href="/designs/farmacia-cialdella/settings" style={{ color: 'var(--fc-blue)' }}>Impostazioni</a>; i conteggi qui sopra si aggiornano subito.
      </p>
    </div>
  )
}
