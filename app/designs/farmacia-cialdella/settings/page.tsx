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
    sb.rpc('farmacia_tag_counts'),
  ])

  // Tag counts aggregated in the DB, merged with the custom-tag catalog so
  // added-but-unused tags still show (count 0).
  const counts = new Map<string, number>()
  for (const r of (tagRows ?? []) as { tag: string; cnt: number }[]) counts.set(r.tag, Number(r.cnt))
  const { data: ct } = await sb.from('farmacia_settings').select('value').eq('key', 'custom_tags').maybeSingle()
  for (const t of (Array.isArray(ct?.value) ? (ct!.value as string[]) : [])) if (!counts.has(t)) counts.set(t, 0)
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
