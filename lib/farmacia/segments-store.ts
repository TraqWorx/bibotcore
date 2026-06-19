/** Server-only DB load/save for the segment config. Pure logic is in segments.ts. */

import { createAdminClient } from '@/lib/supabase-server'
import { DEFAULT_MATCH_MODE, DEFAULT_SEGMENTS, normalizeSegments, type MatchMode, type Segment, type SegmentConfig } from './segments'

export async function getSegmentConfig(): Promise<SegmentConfig> {
  const sb = createAdminClient()
  const { data } = await sb.from('farmacia_settings').select('key, value').in('key', ['segments', 'segment_match'])
  const segRow = data?.find((r) => r.key === 'segments')?.value as Segment[] | undefined
  const modeRow = data?.find((r) => r.key === 'segment_match')?.value as MatchMode | undefined
  const segments = Array.isArray(segRow) && segRow.length
    ? segRow.map((s) => ({ ...s, minSpendCents: s.minSpendCents ?? 0 }))
    : DEFAULT_SEGMENTS
  return { segments, matchMode: modeRow === 'all' ? 'all' : DEFAULT_MATCH_MODE }
}

export async function saveSegmentConfig(config: SegmentConfig): Promise<void> {
  const sb = createAdminClient()
  const now = new Date().toISOString()
  await sb.from('farmacia_settings').upsert([
    { key: 'segments', value: normalizeSegments(config.segments), updated_at: now },
    { key: 'segment_match', value: config.matchMode === 'all' ? 'all' : 'any', updated_at: now },
  ], { onConflict: 'key' })
}
