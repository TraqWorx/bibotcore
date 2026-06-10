import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase-server'

/** Allowed payment-rule offsets (days after Inizio fornitura). */
export const PAYMENT_OFFSET_VALUES = [0, 30] as const
export const DEFAULT_PAYMENT_OFFSET = 30

export function paymentRuleLabel(days: number): string {
  return days === 30 ? '+30 giorni dall’inizio fornitura' : 'Alla data di inizio fornitura'
}

/**
 * Next commission due date for a POD: anchor (Inizio fornitura, else import
 * date) + offset days + paidCount × 6 months. Returns null when there's no
 * anchor.
 */
export function computeNextDue(anchorIso: string | null | undefined, offsetDays: number, paidCount: number): Date | null {
  if (!anchorIso) return null
  const d = new Date(anchorIso)
  if (offsetDays) d.setDate(d.getDate() + offsetDays)
  d.setMonth(d.getMonth() + paidCount * 6)
  return d
}

/**
 * Global default offset (apulia_settings 'payment_offset_days'), defaulting to
 * DEFAULT_PAYMENT_OFFSET when unset. Memoized per request (React cache) so the
 * several due-calc paths on one page don't each re-query the setting.
 */
export const getDefaultPaymentOffset = cache(async (): Promise<number> => {
  const sb = createAdminClient()
  const { data } = await sb.from('apulia_settings').select('value').eq('key', 'payment_offset_days').maybeSingle()
  const v = Number((data as { value?: unknown } | null)?.value)
  return Number.isFinite(v) ? v : DEFAULT_PAYMENT_OFFSET
})
