/**
 * Pure validation + dedup for the channel-box contact import (Modulo 3).
 * Each box (amazon/ebay/store) tags every valid row; the box sets the tag, not
 * a column. Rows missing a name or a valid phone are discarded with a reason.
 * No DB here — persistence lives in import-contacts-store.ts.
 */

import { sanitizePhone } from './transform'
import { type ColumnMap, pick } from './import-config'

export type ImportBox = 'amazon' | 'ebay' | 'store'
export const IMPORT_BOXES: { key: ImportBox; label: string }[] = [
  { key: 'amazon', label: 'Amazon' },
  { key: 'ebay', label: 'eBay' },
  { key: 'store', label: 'Store' },
]

export interface ValidContact {
  phoneNorm: string
  firstName: string | null
  lastName: string | null
  email: string | null
}

export interface ContactValidation {
  valid: ValidContact[]
  discarded: number
  reasons: Record<string, number> // reason → count (telefono mancante, telefono non valido, …)
}

function bump(reasons: Record<string, number>, key: string) {
  reasons[key] = (reasons[key] ?? 0) + 1
}

/** Require name + a valid phone; dedup within the file by normalized phone. */
export function validateContactRows(rows: Record<string, string>[], map: ColumnMap): ContactValidation {
  const valid: ValidContact[] = []
  const reasons: Record<string, number> = {}
  const seen = new Set<string>()

  for (const raw of rows) {
    const fullName = pick(raw, map.fullName)
    let firstName = pick(raw, map.firstName)
    let lastName = pick(raw, map.lastName)
    if (!firstName && !lastName && fullName) {
      const parts = fullName.split(/\s+/)
      firstName = parts.shift() ?? null
      lastName = parts.length ? parts.join(' ') : null
    }
    const email = pick(raw, map.email)?.toLowerCase() ?? null
    const rawPhone = pick(raw, map.phone)

    if (!rawPhone) { bump(reasons, 'telefono mancante'); continue }
    const phone = sanitizePhone(rawPhone)
    if (!phone || phone.replace(/\D/g, '').length < 10) { bump(reasons, 'telefono non valido'); continue }
    if (!firstName && !lastName) { bump(reasons, 'nome mancante'); continue }
    if (seen.has(phone)) { bump(reasons, 'duplicato nel file'); continue }

    seen.add(phone)
    valid.push({ phoneNorm: phone, firstName, lastName, email })
  }

  const discarded = Object.values(reasons).reduce((a, b) => a + b, 0)
  return { valid, discarded, reasons }
}
