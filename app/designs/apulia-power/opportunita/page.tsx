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
  // First-load bootstrap: if cache is empty, sync inline (the user has
  // nothing to look at yet). If cache is just stale (>30 min), fire a
  // refresh in the background so the page renders instantly with what's
  // there and the next visit sees fresh data.
  const STALE_MS = 30 * 60 * 1000
  const { count: cacheCount } = await sb.from('apulia_opportunities').select('ghl_id', { count: 'exact', head: true })
  const { data: lastSyncRow } = await sb.from('apulia_opportunities').select('synced_at').order('synced_at', { ascending: false }).limit(1).maybeSingle()
  const lastSyncAge = lastSyncRow?.synced_at ? Date.now() - new Date(lastSyncRow.synced_at).getTime() : Infinity
  let bootstrapError: string | null = null
  if ((cacheCount ?? 0) === 0) {
    try { await syncOpportunities() } catch (e) { bootstrapError = e instanceof Error ? e.message : 'sync failed' }
  } else if (lastSyncAge > STALE_MS) {
    void syncOpportunities().catch(() => {})
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
            Vista kanban delle pipeline · trascina una card per spostarla in un altro stage.
          </p>
        </div>
      </header>

      {bootstrapError && (
        <div className="ap-card ap-card-pad" style={{ background: 'color-mix(in srgb, var(--ap-danger) 10%, transparent)', color: 'var(--ap-danger)', fontSize: 13 }}>
          ⚠ Errore caricamento iniziale: {bootstrapError}
        </div>
      )}

      <OpportunitiesBoard pipelines={pipelines} opportunities={opportunities} syncedAt={syncedAt} />
    </div>
  )
}
