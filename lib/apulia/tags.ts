import { createAdminClient } from '@/lib/supabase-server'

/**
 * Distinct tags currently in use across apulia_contacts. Used by the
 * TagEditor for type-ahead suggestions so the user picks from existing
 * tags instead of typo-creating near-duplicates ("switch out" vs
 * "switch-out" etc.). Sorted by usage count desc so the most common
 * land at the top of the dropdown.
 */
export async function listDistinctTags(): Promise<string[]> {
  const sb = createAdminClient()
  const counts = new Map<string, number>()
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('apulia_contacts').select('tags').neq('sync_status', 'pending_delete').range(from, from + 999)
    if (!data || data.length === 0) break
    for (const r of data as Array<{ tags: string[] | null }>) {
      for (const t of r.tags ?? []) {
        if (!t) continue
        counts.set(t, (counts.get(t) ?? 0) + 1)
      }
    }
    if (data.length < 1000) break
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
}
