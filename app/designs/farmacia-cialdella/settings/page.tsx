import { createAdminClient } from '@/lib/supabase-server'
import { getSegments } from '@/lib/farmacia/segments'
import CategoryMapForm from './_components/CategoryMapForm'
import SegmentsEditor from './_components/SegmentsEditor'

export const dynamic = 'force-dynamic'

interface CatRow { id: string; sku: string | null; ean: string | null; category: string }

export default async function SettingsPage() {
  const sb = createAdminClient()
  const [{ data: cats }, { count: pending }, { count: failed }, segments] = await Promise.all([
    sb.from('farmacia_category_map').select('id, sku, ean, category').order('category').limit(500),
    sb.from('farmacia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('farmacia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    getSegments(),
  ])
  const rows = (cats ?? []) as CatRow[]

  return (
    <div style={{ padding: 32, maxWidth: 860 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Impostazioni</h1>
      <p style={{ color: 'var(--fc-text-muted)', marginBottom: 24 }}>Sincronizzazione GHL e mappatura categorie.</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Sincronizzazione</h2>
        <div className="fc-card" style={{ padding: 16, display: 'flex', gap: 24 }}>
          <div><div style={{ fontSize: 22, fontWeight: 800 }}>{pending ?? 0}</div><div style={{ fontSize: 12, color: 'var(--fc-text-muted)' }}>In coda</div></div>
          <div><div style={{ fontSize: 22, fontWeight: 800, color: (failed ?? 0) > 0 ? 'var(--fc-danger)' : undefined }}>{failed ?? 0}</div><div style={{ fontSize: 12, color: 'var(--fc-text-muted)' }}>Falliti</div></div>
          <div style={{ alignSelf: 'center', fontSize: 13, color: 'var(--fc-text-faint)' }}>La coda viene svuotata verso GHL ogni minuto.</div>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Livelli fedeltà (segmenti)</h2>
        <p style={{ fontSize: 13, color: 'var(--fc-text-muted)' }}>
          Definisci la soglia di ordini per ogni livello. Il livello di ogni cliente è calcolato in tempo reale: cambiando le soglie, i conteggi si aggiornano subito.
        </p>
        <SegmentsEditor initial={segments} />
      </section>

      <section>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Categorie SKU / EAN</h2>
        <p style={{ fontSize: 13, color: 'var(--fc-text-muted)' }}>
          Usate quando il file non porta già la categoria (es. da Market Rock).
        </p>
        <CategoryMapForm />
        <div className="fc-card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
          <table className="fc-table" style={{ width: '100%' }}>
            <thead><tr><th>SKU</th><th>EAN</th><th>Categoria</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={3} style={{ padding: 16, color: 'var(--fc-text-muted)' }}>Nessuna mappatura.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}><td>{r.sku ?? '—'}</td><td>{r.ean ?? '—'}</td><td>{r.category}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
