import { createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

interface Row {
  id: string
  first_name: string | null
  last_name: string | null
  phone_norm: string | null
  email: string | null
  origin_tags: string[] | null
  orders_count: number
  total_spent_cents: number
  is_conversion: boolean
  sync_status: string
}

function euros(cents: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format((cents ?? 0) / 100)
}

export default async function ClientiPage() {
  const sb = createAdminClient()
  const { data } = await sb
    .from('farmacia_contacts')
    .select('id, first_name, last_name, phone_norm, email, origin_tags, orders_count, total_spent_cents, is_conversion, sync_status')
    .order('total_spent_cents', { ascending: false })
    .limit(200)
  const rows = (data ?? []) as Row[]

  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Clienti</h1>
      <p style={{ color: 'var(--fc-text-muted)', marginBottom: 24 }}>{rows.length} clienti · ordinati per spesa totale.</p>

      <div className="fc-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="fc-table" style={{ width: '100%' }}>
          <thead>
            <tr><th>Cliente</th><th>Contatto</th><th>Canali</th><th>Ordini</th><th>Spesa</th><th>Conv.</th><th>Sync</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} style={{ padding: 16, color: 'var(--fc-text-muted)' }}>Nessun cliente ancora. Importa gli ordini.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</td>
                <td style={{ fontSize: 13 }}>{r.phone_norm ?? r.email ?? '—'}</td>
                <td style={{ fontSize: 12 }}>{(r.origin_tags ?? []).join(', ') || '—'}</td>
                <td>{r.orders_count}</td>
                <td>{euros(r.total_spent_cents)}</td>
                <td>{r.is_conversion ? <span className="fc-pill" data-tone="green">sì</span> : '—'}</td>
                <td><span className="fc-pill" data-tone={r.sync_status === 'synced' ? 'green' : r.sync_status === 'failed' ? 'red' : 'amber'}>{r.sync_status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
