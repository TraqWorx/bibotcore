/**
 * Farmacia Cialdella — GHL location + known tags/fields.
 * Centralised so renaming/recreating fields means changing one place.
 *
 * GHL account name shows as "PARAFARMACIA PADRE PIO S.R.L.S"; connected 2026-06-19.
 * Custom field ids are TBD — fill in once the GHL location's fields are known.
 */

export const FARMACIA_LOCATION_ID = 'JhsFebrSPpgtXzUMa2wg'
export const GHL_BASE = 'https://services.leadconnectorhq.com'

/** Origin/channel a customer order came through. */
export const FARMACIA_ORIGIN = {
  AMAZON: 'amazon',
  EBAY: 'ebay',
  ONLINE_STORE: 'online_store',
  STORE: 'store',
  OTHER: 'other',
} as const

export type FarmaciaOrigin = (typeof FARMACIA_ORIGIN)[keyof typeof FARMACIA_ORIGIN]

/** GHL tag a channel maps to (drives nurturing automations). null = no tag. */
export function channelTag(origin: FarmaciaOrigin): string | null {
  switch (origin) {
    case FARMACIA_ORIGIN.AMAZON: return 'amazon'
    case FARMACIA_ORIGIN.EBAY: return 'ebay'
    case FARMACIA_ORIGIN.STORE: return 'store'
    case FARMACIA_ORIGIN.ONLINE_STORE: return 'sito'
    default: return null
  }
}

/** Tags written to GHL contacts. */
export const FARMACIA_TAG = {
  CUSTOMER: 'cliente',
  CONVERSION: 'conversione',
  ORIGIN_AMAZON: 'origine-amazon',
  ORIGIN_EBAY: 'origine-ebay',
  ORIGIN_ONLINE_STORE: 'origine-online-store',
} as const

/** Custom field ids on contacts at the Farmacia location. TODO: fill from GHL. */
export const FARMACIA_FIELD: Record<string, string> = {
  // EXAMPLE_FIELD: 'xxxxxxxxxxxxxxxxxxxx',
}

export interface CustomFieldEntry { id: string; value?: string }
export function getField(customFields: CustomFieldEntry[] | undefined, id: string): string | undefined {
  if (!customFields) return undefined
  const f = customFields.find((x) => x.id === id)
  if (!f || f.value == null) return undefined
  return String(f.value)
}
