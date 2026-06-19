import { createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function euros(cents: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

export default async function DashboardPage() {
  const sb = createAdminClient()
  const [{ count: customers }, { count: orders }, { count: conversions }, { data: spendRows }] = await Promise.all([
    sb.from('farmacia_contacts').select('id', { count: 'exact', head: true }),
    sb.from('farmacia_orders').select('id', { count: 'exact', head: true }),
    sb.from('farmacia_contacts').select('id', { count: 'exact', head: true }).eq('is_conversion', true),
    sb.from('farmacia_orders').select('total_cents'),
  ])
  const revenue = (spendRows ?? []).reduce((s, r) => s + (r.total_cents ?? 0), 0)

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

      <p style={{ color: 'var(--fc-text-faint)', fontSize: 13, marginTop: 24 }}>
        Grafici per canale e categoria in arrivo. Importa gli ordini da{' '}
        <a href="/designs/farmacia-cialdella/imports" style={{ color: 'var(--fc-blue)' }}>Importazioni</a>.
      </p>
    </div>
  )
}
