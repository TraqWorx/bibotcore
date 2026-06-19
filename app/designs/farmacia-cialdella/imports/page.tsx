import { createAdminClient } from '@/lib/supabase-server'
import DropZone from './_components/DropZone'

export const dynamic = 'force-dynamic'

interface ImportRow {
  id: string
  filename: string | null
  rows_total: number | null
  orders_created: number | null
  items_created: number | null
  conversions: number | null
  status: string
  error_msg: string | null
  created_at: string
}

export default async function ImportsPage() {
  const sb = createAdminClient()
  const { data } = await sb
    .from('farmacia_imports')
    .select('id, filename, rows_total, orders_created, items_created, conversions, status, error_msg, created_at')
    .order('created_at', { ascending: false })
    .limit(20)
  const history = (data ?? []) as ImportRow[]

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Importazioni</h1>
      <p style={{ color: 'var(--fc-text-muted)', marginBottom: 24 }}>
        Carica l&apos;export ordini. I clienti e gli ordini vengono creati e sincronizzati su GoHighLevel.
      </p>

      <DropZone />

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '28px 0 12px' }}>Storico</h2>
      <div className="fc-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="fc-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>File</th><th>Righe</th><th>Ordini</th><th>Articoli</th><th>Conversioni</th><th>Stato</th><th>Data</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 16, color: 'var(--fc-text-muted)' }}>Nessuna importazione ancora.</td></tr>
            )}
            {history.map((h) => (
              <tr key={h.id}>
                <td>{h.filename ?? '—'}</td>
                <td>{h.rows_total ?? '—'}</td>
                <td>{h.orders_created ?? '—'}</td>
                <td>{h.items_created ?? '—'}</td>
                <td>{h.conversions ?? '—'}</td>
                <td>
                  <span className="fc-pill" data-tone={h.status === 'completed' ? 'green' : h.status === 'failed' ? 'red' : 'amber'}>
                    {h.status}
                  </span>
                  {h.error_msg && <span style={{ color: 'var(--fc-danger)', fontSize: 12, marginLeft: 8 }}>{h.error_msg}</span>}
                </td>
                <td>{new Date(h.created_at).toLocaleString('it-IT')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
