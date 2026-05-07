import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { listPipelinesCached, listOpportunitiesCached, syncOpportunities } from '@/lib/apulia/opportunities'
import { createAdminClient } from '@/lib/supabase-server'
import OpportunitiesBoard from './_components/OpportunitiesBoard'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  const sb = createAdminClient()
  // First-load bootstrap: if cache is empty, sync once now so the
  // owner doesn't see an empty board on page open. Subsequent loads
  // read directly from the cache.
  const { count: cacheCount } = await sb.from('apulia_opportunities').select('ghl_id', { count: 'exact', head: true })
  let bootstrapError: string | null = null
  if ((cacheCount ?? 0) === 0) {
    try { await syncOpportunities() } catch (e) { bootstrapError = e instanceof Error ? e.message : 'sync failed' }
  }

  const [pipelines, opportunities, { data: latestSync }] = await Promise.all([
    listPipelinesCached(),
    listOpportunitiesCached(),
    sb.from('apulia_opportunities').select('synced_at').order('synced_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const syncedAt = latestSync?.synced_at ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="ap-page-title">Opportunità</h1>
          <p className="ap-page-subtitle">
            Vista kanban delle pipeline GHL · trascina una card per spostarla in un altro stage. I dati sono memorizzati localmente per velocità.
          </p>
        </div>
      </header>

      {bootstrapError && (
        <div className="ap-card ap-card-pad" style={{ background: 'color-mix(in srgb, var(--ap-danger) 10%, transparent)', color: 'var(--ap-danger)', fontSize: 13 }}>
          ⚠ Errore caricamento iniziale da GHL: {bootstrapError}
        </div>
      )}

      <OpportunitiesBoard pipelines={pipelines} opportunities={opportunities} syncedAt={syncedAt} />
    </div>
  )
}
