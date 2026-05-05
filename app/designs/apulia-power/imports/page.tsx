import { createAdminClient } from '@/lib/supabase-server'
import { getApuliaSession } from '@/lib/apulia/auth'
import { redirect } from 'next/navigation'
import DropZone from './_components/DropZone'

export const dynamic = 'force-dynamic'

export default async function ImportsPage() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  const sb = createAdminClient()
  const { data: history } = await sb
    .from('apulia_imports')
    .select('id, kind, filename, rows_total, created, updated, tagged, untagged, unmatched, duration_ms, triggered_by, created_at')
    .order('created_at', { ascending: false })
    .limit(15)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 className="ap-page-title">Import</h1>
        <p className="ap-page-subtitle">
          Carica i file settimanali. Il sistema aggiorna i contatti, gestisce i tag Switch-out e ricalcola le commissioni automaticamente.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <DropZone
          kind="pdp"
          title="PDP ATTIVI"
          subtitle="Tutti i POD attualmente attivi. Crea/aggiorna i contatti e rimuove eventuali tag Switch-out riattivati."
          endpoint="/api/apulia/import/pdp"
          emoji="📥"
        />
        <DropZone
          kind="switch_out"
          title="Switch-out"
          subtitle="POD usciti dal contratto. Aggiunge il tag Switch-out e li esclude dal calcolo commissione."
          endpoint="/api/apulia/import/switch-out"
          emoji="📤"
        />
        <DropZone
          kind="admins"
          title="Amministratori"
          subtitle="Lista amministratori con compenso, CF, P.IVA e contatti. Match per Codice amministratore; i nuovi vengono creati con tag amministratore."
          endpoint="/api/apulia/import/admins"
          emoji="👤"
        />
      </div>

      <section className="ap-card">
        <header style={{ padding: '16px 20px', borderBottom: '1px solid var(--ap-line)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em' }}>Storico</h2>
        </header>
        <div style={{ overflowX: 'auto' }}>
          <table className="ap-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Tipo</th>
                <th>File</th>
                <th>Righe</th>
                <th>Risultato</th>
                <th>Durata</th>
                <th>Da</th>
              </tr>
            </thead>
            <tbody>
              {(history ?? []).length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--ap-text-faint)' }}>Nessun import effettuato.</td></tr>
              )}
              {(history ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td><span className="ap-pill" data-tone={r.kind === 'pdp' ? 'blue' : 'amber'}>{r.kind === 'pdp' ? 'PDP' : 'Switch-out'}</span></td>
                  <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.filename ?? ''}>{r.filename}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.rows_total?.toLocaleString('it-IT')}</td>
                  <td style={{ fontSize: 12 }}>
                    {r.kind === 'pdp'
                      ? <>+{r.created ?? 0} · ↻{r.updated ?? 0}{r.untagged ? ` · 🔓${r.untagged}` : ''}{r.unmatched ? ` · ⚠${r.unmatched}` : ''}</>
                      : <>📤{r.tagged ?? 0}{r.unmatched ? ` · ?${r.unmatched}` : ''}</>}
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ap-text-muted)' }}>{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                  <td style={{ color: 'var(--ap-text-muted)', fontSize: 12 }}>{r.triggered_by ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
