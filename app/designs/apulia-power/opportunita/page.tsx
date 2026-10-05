import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { listPipelinesCached, listOpportunitiesCached, syncOpportunities } from '@/lib/apulia/opportunities'
import { createAdminClient } from '@/lib/supabase-server'
import { getApuliaSyncState } from '@/lib/apulia/cache'
import OpportunitiesBoard from './_components/OpportunitiesBoard'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  const sb = createAdminClient()
  // Refresh at most once per window, counted from the last ATTEMPT. Counting
  // from the last cached row instead meant that a location with no
  // opportunities in GHL — which is this one — never left the "cache is empty,
  // sync inline" branch, so every view blocked on a full GHL pull.
  const STALE_MINUTES = 30
  const [{ count: cacheCount }, syncState] = await Promise.all([
    sb.from('apulia_opportunities').select('ghl_id', { count: 'exact', head: true }),
    getApuliaSyncState(),
  ])
  let bootstrapError: string | null = null
  if (syncState.opportunitiesAgeMinutes > STALE_MINUTES) {
    if ((cacheCount ?? 0) === 0) {
      // Nothing to render yet, so this one visit waits for the data.
      try { await syncOpportunities() } catch (e) { bootstrapError = e instanceof Error ? e.message : 'sync failed' }
    } else {
      void syncOpportunities().catch(() => {})
    }
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
