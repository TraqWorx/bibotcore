import { createAdminClient } from '@/lib/supabase-server'
import { getSegmentConfig } from '@/lib/farmacia/segments-store'
import { getClusterization } from '@/lib/farmacia/dashboard'
import SettingsTabs from './_components/SettingsTabs'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const sb = createAdminClient()
  const [{ count: pending }, { count: failed }, segmentConfig, clusters, { data: tagRows }] = await Promise.all([
    sb.from('farmacia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('farmacia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    getSegmentConfig(),
    getClusterization(),
    sb.from('farmacia_contacts').select('tags').limit(10000),
  ])

  // Tag usage counts (unnest tags client-side over the loaded set).
  const counts = new Map<string, number>()
  for (const r of tagRows ?? []) for (const t of (r.tags ?? []) as string[]) counts.set(t, (counts.get(t) ?? 0) + 1)
  const tags = [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count)

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Impostazioni</h1>
      <p style={{ color: 'var(--fc-text-muted)', marginBottom: 24 }}>Livelli fedeltà, tag, categorie e sincronizzazione.</p>
      <SettingsTabs
        config={segmentConfig}
        clusters={clusters}
        tags={tags}
        pending={pending ?? 0}
        failed={failed ?? 0}
      />
    </div>
  )
}
