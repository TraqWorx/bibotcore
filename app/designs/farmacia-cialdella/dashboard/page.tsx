import Link from 'next/link'
import { getOverview, getTopCustomers, getClusterization, getCategoryStats, type TopCustomer } from '@/lib/farmacia/dashboard'
import PieChart from '../_components/PieChart'
import CategoryTable from './_components/CategoryTable'

export const dynamic = 'force-dynamic'

function euros(cents: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format((cents ?? 0) / 100)
}

const PERIODS: Record<string, string> = { '30d': 'Ultimi 30 giorni', ytd: "Quest'anno", all: 'Sempre' }

function periodRange(period: string): { from: Date; to: Date } {
  const to = new Date()
  if (period === '30d') return { from: new Date(to.getTime() - 30 * 86400_000), to }
  if (period === 'ytd') return { from: new Date(Date.UTC(to.getUTCFullYear(), 0, 1)), to }
  return { from: new Date(0), to }
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams
  const period = sp.period && PERIODS[sp.period] ? sp.period : 'all'
  const { from, to } = periodRange(period)

  const [overview, top, clusters, categories] = await Promise.all([
    getOverview(from, to),
    getTopCustomers(20),
    getClusterization(),
    getCategoryStats(),
  ])

  const stats = [
    { label: 'Ordini', value: String(overview.ordersCount) },
    { label: 'Fatturato', value: euros(overview.revenueCents) },
    { label: 'Scontrino medio', value: euros(overview.aovCents) },
    { label: 'Nuovi clienti', value: String(overview.newCustomers) },
    { label: 'Clienti ricorrenti', value: String(overview.recurringCustomers) },
    { label: 'Conversioni Amazon', value: String(overview.amazonConversions) },
    { label: 'Conversioni eBay', value: String(overview.ebayConversions) },
  ]

  return (
    <div style={{ padding: 32, maxWidth: 1160 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Dashboard</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.entries(PERIODS).map(([k, label]) => (
            <Link key={k} href={`?period=${k}`} className="fc-pill" data-tone={period === k ? 'blue' : 'gray'} style={{ textDecoration: 'none' }}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* 1.1 Vista d'insieme */}
      <h2 style={sectionH}>Vista d&apos;insieme</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16 }}>
        {stats.map((s) => (
          <div key={s.label} className="fc-stat" data-tone="neutral">
            <div style={{ fontSize: 24, fontWeight: 800 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--fc-text-muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 1.2 Top clienti */}
      <h2 style={sectionH}>Top clienti</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
        <TopList title="Per spesa totale" rows={top.bySpend} value={(c) => euros(c.totalSpentCents)} />
        <TopList title="Per numero di ordini" rows={top.byOrders} value={(c) => `${c.ordersCount} ordini`} />
        <TopList title="Per scontrino medio" rows={top.byAov} value={(c) => euros(c.avgOrderCents)} />
      </div>

      {/* 1.3 Clusterizzazione */}
      <h2 style={sectionH}>Clusterizzazione clienti</h2>
      <div className="fc-card" style={{ padding: 20 }}>
        <PieChart slices={clusters.map((c) => ({ label: c.name, value: c.count, color: c.color }))} />
        <table className="fc-table" style={{ width: '100%', marginTop: 16 }}>
          <thead><tr><th>Fascia</th><th>Clienti</th><th>Fatturato</th><th>Scontrino medio</th></tr></thead>
          <tbody>
            {clusters.map((c) => (
              <tr key={c.name}>
                <td><span className="fc-pill" data-tone={c.color ?? 'gray'}>{c.name}</span></td>
                <td>{c.count}</td>
                <td>{euros(c.revenueCents)}</td>
                <td>{euros(c.aovCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 1.5 Categorie prodotto */}
      <h2 style={sectionH}>Categorie prodotto</h2>
      <CategoryTable rows={categories} />
    </div>
  )
}

const sectionH: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: '32px 0 12px' }

function TopList({ title, rows, value }: { title: string; rows: TopCustomer[]; value: (c: TopCustomer) => string }) {
  return (
    <div className="fc-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', fontWeight: 700, borderBottom: '1px solid var(--fc-line)' }}>{title}</div>
      <div>
        {rows.length === 0 && <div style={{ padding: 14, color: 'var(--fc-text-muted)', fontSize: 13 }}>Nessun dato.</div>}
        {rows.map((c, i) => (
          <Link
            key={c.id}
            href={`/designs/farmacia-cialdella/clienti/${c.id}`}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid var(--fc-line)', textDecoration: 'none', color: 'var(--fc-text)', fontSize: 13 }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i + 1}. {c.name}</span>
            <strong style={{ flexShrink: 0, marginLeft: 8 }}>{value(c)}</strong>
          </Link>
        ))}
      </div>
    </div>
  )
}
