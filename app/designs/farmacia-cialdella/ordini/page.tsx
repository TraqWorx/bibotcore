import { createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

interface OrderRow {
  id: string
  order_ext_id: string
  channel: string
  order_date: string | null
  total_cents: number | null
  category: string | null
  contact_id: string | null
  farmacia_contacts: { first_name: string | null; last_name: string | null } | null
}

function euros(cents: number | null): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format((cents ?? 0) / 100)
}

export default async function OrdiniPage() {
  const sb = createAdminClient()
  const { data } = await sb
    .from('farmacia_orders')
    .select('id, order_ext_id, channel, order_date, total_cents, category, contact_id, farmacia_contacts(first_name, last_name)')
    .order('order_date', { ascending: false, nullsFirst: false })
    .limit(200)
  const rows = (data ?? []) as unknown as OrderRow[]

  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Ordini</h1>
      <p style={{ color: 'var(--fc-text-muted)', marginBottom: 24 }}>Ultimi {rows.length} ordini.</p>

      <div className="fc-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="fc-table" style={{ width: '100%' }}>
          <thead>
            <tr><th>Ordine</th><th>Cliente</th><th>Canale</th><th>Categoria</th><th>Totale</th><th>Data</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} style={{ padding: 16, color: 'var(--fc-text-muted)' }}>Nessun ordine ancora.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontSize: 13 }}>{r.order_ext_id}</td>
                <td>{[r.farmacia_contacts?.first_name, r.farmacia_contacts?.last_name].filter(Boolean).join(' ') || '—'}</td>
                <td><span className="fc-pill" data-tone={r.channel === 'online_store' ? 'green' : r.channel === 'other' ? 'gray' : 'blue'}>{r.channel}</span></td>
                <td style={{ fontSize: 13 }}>{r.category ?? '—'}</td>
                <td>{euros(r.total_cents)}</td>
                <td style={{ fontSize: 13 }}>{r.order_date ? new Date(r.order_date).toLocaleDateString('it-IT') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
