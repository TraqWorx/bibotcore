/**
 * Customer loyalty segments (Bronzo/Argento/Oro/…). Each tier has an order-count
 * threshold AND a spend threshold; a global match mode decides whether a
 * customer must meet ANY specified threshold (default) or ALL of them. A
 * threshold of 0 means "not required". Tiers are an ORDERED list (low → high);
 * a customer's tier is the highest one they meet, derived at read time so
 * editing thresholds instantly re-buckets everyone.
 *
 * Config lives in farmacia_settings: key 'segments' (Segment[]) + 'segment_match'.
 */

import { createAdminClient } from '@/lib/supabase-server'

export type MatchMode = 'any' | 'all'

export interface Segment {
  name: string
  minOrders: number
  minSpendCents: number
  color?: string
}

export interface SegmentConfig {
  segments: Segment[]
  matchMode: MatchMode
}

export const DEFAULT_SEGMENTS: Segment[] = [
  { name: 'Bronzo', minOrders: 0, minSpendCents: 0, color: 'gray' },
  { name: 'Argento', minOrders: 5, minSpendCents: 0, color: 'blue' },
  { name: 'Oro', minOrders: 20, minSpendCents: 0, color: 'amber' },
  { name: 'Platino', minOrders: 50, minSpendCents: 0, color: 'green' },
]
export const DEFAULT_MATCH_MODE: MatchMode = 'any'

/** Does a customer meet a tier's thresholds under the given match mode? Pure. */
export function meetsTier(s: Segment, ordersCount: number, totalSpentCents: number, mode: MatchMode): boolean {
  const orderReq = s.minOrders > 0
  const spendReq = (s.minSpendCents ?? 0) > 0
  if (!orderReq && !spendReq) return true // base tier — no requirements
  const okOrders = ordersCount >= s.minOrders
  const okSpend = totalSpentCents >= (s.minSpendCents ?? 0)
  if (mode === 'all') return (!orderReq || okOrders) && (!spendReq || okSpend)
  return (orderReq && okOrders) || (spendReq && okSpend) // any
}

/** Highest tier (by list order) the customer meets. Pure — tested. */
export function computeTier(ordersCount: number, totalSpentCents: number, config: SegmentConfig): Segment | null {
  let tier: Segment | null = null
  for (const s of config.segments) if (meetsTier(s, ordersCount, totalSpentCents, config.matchMode)) tier = s
  return tier
}

/** Count customers per tier. Pure — tested. */
export function countByTier(customers: { ordersCount: number; totalSpentCents: number }[], config: SegmentConfig): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of config.segments) out[s.name] = 0
  for (const c of customers) {
    const t = computeTier(c.ordersCount, c.totalSpentCents, config)
    if (t) out[t.name] = (out[t.name] ?? 0) + 1
  }
  return out
}

/** Average order value (scontrino medio) in cents. Pure — tested. */
export function averageOrderCents(totalSpentCents: number, ordersCount: number): number {
  return ordersCount > 0 ? Math.round(totalSpentCents / ordersCount) : 0
}

/** GHL tag for a tier name, e.g. "Oro" → "livello-oro". Pure — tested. */
export function tierTag(name: string): string {
  return 'livello-' + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Drop blanks and clamp negatives; preserve list order (order = tier rank). */
export function normalizeSegments(input: Segment[]): Segment[] {
  return input
    .filter((s) => s.name && s.name.trim())
    .map((s) => ({
      name: s.name.trim(),
      minOrders: Math.max(0, Math.floor(s.minOrders || 0)),
      minSpendCents: Math.max(0, Math.floor(s.minSpendCents || 0)),
      color: s.color,
    }))
}

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
