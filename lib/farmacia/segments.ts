/**
 * Customer loyalty segments (Bronzo/Argento/Oro/…). Tiers are defined by a
 * minimum order count and stored in farmacia_settings (key 'segments') so the
 * owner can edit thresholds in Settings. Tier is DERIVED from a contact's
 * orders_count at read time — never frozen — so changing a threshold instantly
 * re-buckets everyone.
 */

import { createAdminClient } from '@/lib/supabase-server'

export interface Segment {
  name: string
  minOrders: number
  color?: string
}

export const DEFAULT_SEGMENTS: Segment[] = [
  { name: 'Bronzo', minOrders: 0, color: 'gray' },
  { name: 'Argento', minOrders: 5, color: 'blue' },
  { name: 'Oro', minOrders: 20, color: 'amber' },
  { name: 'Platino', minOrders: 50, color: 'green' },
]

/** Highest segment whose threshold the order count meets. Pure — tested. */
export function computeTier(ordersCount: number, segments: Segment[]): Segment | null {
  const sorted = [...segments].sort((a, b) => a.minOrders - b.minOrders)
  let tier: Segment | null = null
  for (const s of sorted) if (ordersCount >= s.minOrders) tier = s
  return tier
}

/** Count how many customers fall in each segment. Pure — tested. */
export function countByTier(orderCounts: number[], segments: Segment[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of segments) out[s.name] = 0
  for (const n of orderCounts) {
    const t = computeTier(n, segments)
    if (t) out[t.name] = (out[t.name] ?? 0) + 1
  }
  return out
}

/** Average order value (scontrino medio) in cents. Pure — tested. */
export function averageOrderCents(totalSpentCents: number, ordersCount: number): number {
  return ordersCount > 0 ? Math.round(totalSpentCents / ordersCount) : 0
}

/** Validate + normalize an edited segment list (drop blanks, clamp, sort). */
export function normalizeSegments(input: Segment[]): Segment[] {
  return input
    .filter((s) => s.name && s.name.trim())
    .map((s) => ({ name: s.name.trim(), minOrders: Math.max(0, Math.floor(s.minOrders || 0)), color: s.color }))
    .sort((a, b) => a.minOrders - b.minOrders)
}

export async function getSegments(): Promise<Segment[]> {
  const sb = createAdminClient()
  const { data } = await sb.from('farmacia_settings').select('value').eq('key', 'segments').maybeSingle()
  const v = data?.value as Segment[] | undefined
  return Array.isArray(v) && v.length ? v : DEFAULT_SEGMENTS
}

export async function saveSegments(segments: Segment[]): Promise<void> {
  const sb = createAdminClient()
  await sb.from('farmacia_settings').upsert(
    { key: 'segments', value: normalizeSegments(segments), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}
