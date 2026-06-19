import { createAdminClient } from '@/lib/supabase-server'
import ImportBox from './_components/ImportBox'

export const dynamic = 'force-dynamic'

interface ImportRow {
  id: string
  origin: string | null
  filename: string | null
  file_url: string | null
  rows_total: number | null
  created: number | null
  updated: number | null
  discarded: number | null
  status: string
  error_msg: string | null
  summary: { reasons?: Record<string, number> } | null
  created_at: string
}

const ORIGIN_LABEL: Record<string, string> = { amazon: 'Amazon', ebay: 'eBay', store: 'Store', sito: 'Sito' }

export default async function ImportsPage() {
  const sb = createAdminClient()
  const { data } = await sb
    .from('farmacia_imports')
    .select('id, origin, filename, file_url, rows_total, created, updated, discarded, status, error_msg, summary, created_at')
    .order('created_at', { ascending: false })
    .limit(30)
  const history = (data ?? []) as ImportRow[]

  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Importazioni</h1>
      <p style={{ color: 'var(--fc-text-muted)', marginBottom: 24 }}>
        Carica un file per canale. Il box determina il tag applicato, che fa partire la sequenza di nurturing su GoHighLevel.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
        <ImportBox label="Amazon" hint="Tag amazon → sequenza WhatsApp soft-push verso il sito" endpoint="/api/farmacia/import/contacts?box=amazon" tone="blue" />
        <ImportBox label="eBay" hint="Tag ebay → sequenza WhatsApp dedicata eBay" endpoint="/api/farmacia/import/contacts?box=ebay" tone="blue" />
        <ImportBox label="Store" hint="Tag store → sequenza SMS promo clienti store" endpoint="/api/farmacia/import/contacts?box=store" tone="blue" />
        <ImportBox label="Sito — ordini" hint="Ordini del sito (ShippyPro/Market Rock): popola ordini e conversioni" endpoint="/api/farmacia/import/orders" tone="green" />
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '28px 0 12px' }}>Storico import</h2>
      <div className="fc-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="fc-table" style={{ width: '100%' }}>
          <thead>
            <tr><th>Data e ora</th><th>Box</th><th>File</th><th>Record</th><th>Importati</th><th>Scartati</th><th>Stato</th></tr>
          </thead>
          <tbody>
            {history.length === 0 && <tr><td colSpan={7} style={{ padding: 16, color: 'var(--fc-text-muted)' }}>Nessuna importazione ancora.</td></tr>}
            {history.map((h) => {
              const imported = (h.created ?? 0) + (h.updated ?? 0)
              const reasons = h.summary?.reasons ?? {}
              return (
                <tr key={h.id}>
                  <td style={{ fontSize: 13 }}>{new Date(h.created_at).toLocaleString('it-IT')}</td>
                  <td>{h.origin ? <span className="fc-pill" data-tone={h.origin === 'sito' ? 'green' : 'blue'}>{ORIGIN_LABEL[h.origin] ?? h.origin}</span> : '—'}</td>
                  <td style={{ fontSize: 13 }}>
                    {h.file_url ? <a href={h.file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--fc-blue)' }}>{h.filename ?? 'scarica'}</a> : (h.filename ?? '—')}
                  </td>
                  <td>{h.rows_total ?? '—'}</td>
                  <td>{imported}</td>
                  <td>
                    {h.discarded ?? 0}
                    {Object.keys(reasons).length > 0 && (
                      <span style={{ color: 'var(--fc-text-faint)', fontSize: 11, display: 'block' }}>
                        {Object.entries(reasons).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="fc-pill" data-tone={h.status === 'completed' ? 'green' : h.status === 'failed' ? 'red' : 'amber'}>{h.status}</span>
                    {h.error_msg && <span style={{ color: 'var(--fc-danger)', fontSize: 11, display: 'block' }}>{h.error_msg}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
