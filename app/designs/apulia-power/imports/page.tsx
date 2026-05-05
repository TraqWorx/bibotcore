import { createAdminClient } from '@/lib/supabase-server'
import { getApuliaSession } from '@/lib/apulia/auth'
import { redirect } from 'next/navigation'
import DropZone from './_components/DropZone'
import ImportsStorico, { type ImportRow } from './_components/ImportsStorico'

export const dynamic = 'force-dynamic'

export default async function ImportsPage() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  const sb = createAdminClient()
  const { data: history } = await sb
    .from('apulia_imports')
    .select('id, kind, filename, rows_total, created, updated, tagged, untagged, unmatched, skipped, duration_ms, triggered_by, created_at, status, progress_done, progress_total, last_progress_at')
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
        <ImportsStorico initial={(history ?? []) as ImportRow[]} />
      </section>
    </div>
  )
}
