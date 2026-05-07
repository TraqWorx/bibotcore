import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { listPipelines, listOpportunities } from '@/lib/apulia/opportunities'
import OpportunitiesBoard from './_components/OpportunitiesBoard'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  let pipelines: Awaited<ReturnType<typeof listPipelines>> = []
  let opportunities: Awaited<ReturnType<typeof listOpportunities>> = []
  let error: string | null = null
  try {
    [pipelines, opportunities] = await Promise.all([listPipelines(), listOpportunities()])
  } catch (err) {
    error = err instanceof Error ? err.message : 'Errore imprevisto'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 className="ap-page-title">Opportunità</h1>
        <p className="ap-page-subtitle">
          Vista kanban delle pipeline GHL · clicca sul menu di una card per spostarla in un altro stage.
        </p>
      </header>

      {error && (
        <div className="ap-card ap-card-pad" style={{ background: 'color-mix(in srgb, var(--ap-danger) 10%, transparent)', color: 'var(--ap-danger)', fontSize: 13 }}>
          ⚠ Errore caricamento da GHL: {error}
        </div>
      )}

      {!error && <OpportunitiesBoard pipelines={pipelines} opportunities={opportunities} />}
    </div>
  )
}
