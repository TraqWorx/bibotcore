/**
 * Apulia Power — known custom field IDs and tag names.
 * Centralised so renaming/recreating fields means changing one place.
 */

export const APULIA_TAG = {
  AMMINISTRATORE: 'amministratore',
  SWITCH_OUT: 'Switch-out',
} as const

/** Custom field ids on contacts at Apulia Power location. */
export const APULIA_FIELD = {
  POD_PDR: '3E3OuE0iNMHKe6CWSl3o',
  STATO: 'Hnx2noBu7RGtmXby3DRo',
  CODICE_AMMINISTRATORE: '3VwwjdaKH8oQgUO1Vwih',
  AMMINISTRATORE_CONDOMINIO: 'z1HlsBxzFtHaCaZ01KnT',
  CODICE_FISCALE_AMMINISTRATORE: '1OdFYfrSBv45SpzpXjYU',
  PARTITA_IVA_AMMINISTRATORE: 'umw0sKwGDNNoAjEfgbF7',
  TELEFONO_AMMINISTRATORE: 'Z64lLhsexIXdoeVm0rOQ',
  EMAIL_BILLING: 'VhxwXDyczBN04vmRUTDf',
  CLIENTE: 'kgGrpZOgfUZoeTfhs7Ef',
  COMPENSO_PER_POD: 'kC4I003OOGX4MyGUw8fj',
  COMMISSIONE_TOTALE: 'EEaur1fU5jr56DhfL2eI',
  POD_OVERRIDE: 'IhdF9njhnYTwMGrzOQlg',
} as const

export const APULIA_LOCATION_ID = 'VtNhBfleEQDg0KX4eZqY'
export const GHL_BASE = 'https://services.leadconnectorhq.com'

export interface CustomFieldEntry { id: string; value?: string }
export function getField(customFields: CustomFieldEntry[] | undefined, id: string): string | undefined {
  if (!customFields) return undefined
  const f = customFields.find((x) => x.id === id)
  if (!f || f.value == null) return undefined
  return String(f.value)
}

/** Current period code, e.g. '2026-H1' for Jan-Jun, '2026-H2' for Jul-Dec. */
export function currentPeriod(d: Date = new Date()): string {
  const half = d.getUTCMonth() < 6 ? 'H1' : 'H2'
  return `${d.getUTCFullYear()}-${half}`
}
