import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase-server'

/** Allowed payment-rule offsets (days after Inizio fornitura). */
export const PAYMENT_OFFSET_VALUES = [0, 30] as const
export const DEFAULT_PAYMENT_OFFSET = 30

export function paymentRuleLabel(days: number): string {
  return days === 30 ? '+30 giorni dall’inizio fornitura' : 'Alla data di inizio fornitura'
}

/**
 * Next commission due date for a POD. Cycle dates align to Inizio fornitura
 * (anchor, else import date) + offset days, every 6 months. We do NOT bill the
 * past: cycles that fully elapsed before the POD was onboarded (`onboardedIso`,
 * the import date) are skipped, so the first owed cycle is the one current at
 * onboarding. Next due = first-owed-cycle + paidCount × 6 months. Null if no
 * anchor.
 */
export function computeNextDue(
  anchorIso: string | null | undefined,
  offsetDays: number,
  paidCount: number,
  onboardedIso?: string | null,
): Date | null {
  if (!anchorIso) return null
  const base = new Date(anchorIso)
  if (offsetDays) base.setDate(base.getDate() + offsetDays)

  // Skip every cycle whose start is before onboarding — we don't bill the
  // past, and since payment is in advance, a cycle that already started is a
  // past payment. First owed cycle = the first boundary on/after onboarding.
  let cyclesToSkip = 0
  if (onboardedIso) {
    const onboarded = new Date(onboardedIso).getTime()
    const probe = new Date(base)
    while (probe.getTime() < onboarded) {
      cyclesToSkip++
      probe.setMonth(probe.getMonth() + 6)
    }
  }

  const d = new Date(base)
  d.setMonth(d.getMonth() + (cyclesToSkip + paidCount) * 6)
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
