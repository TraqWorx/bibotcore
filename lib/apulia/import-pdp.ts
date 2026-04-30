import { fetchAllContacts, indexByPodPdr, upsertContact, removeTag, type ApuliaContact, pmap } from './contacts'
import { APULIA_FIELD, APULIA_TAG } from './fields'
import { recomputeCommissions, type RecomputeResult } from './recompute'

export type ImportEvent =
  | { type: 'preflight' }
  | { type: 'start'; total: number }
  | { type: 'progress'; done: number; total: number; created: number; updated: number; untagged: number; unmatched: number; skipped: number }
  | { type: 'recompute' }
  | { type: 'done'; created: number; updated: number; untagged: number; unmatched: number; skipped: number; recompute: RecomputeResult; durationMs: number }
  | { type: 'error'; message: string }

const COL = {
  PodPdr: 'POD/PDR',
  CodiceAmm: 'Fornitura : Cliente : Codice amministratore',
  Cliente: 'Cliente',
  Email: 'Fornitura : Dati di fatturazione : Email',
  Phone: 'Fornitura : Cliente : Numero di telefono',
  Mobile: 'Fornitura : Cliente : Numero di cellulare',
}

/**
 * Map every CSV column whose header equals a known custom-field name to
 * that custom field id. Built once per import.
 */
function buildColumnFieldMap(headers: string[], fieldByName: Map<string, string>): Map<string, string> {
  const m = new Map<string, string>()
  for (const h of headers) {
    const id = fieldByName.get(h)
    if (id) m.set(h, id)
  }
  return m
}

export async function* importPdp(rows: Record<string, string>[], headers: string[], allFields: { id: string; name: string }[]): AsyncGenerator<ImportEvent> {
  const startedAt = Date.now()
  yield { type: 'preflight' }

  const fieldByName = new Map(allFields.map((f) => [f.name, f.id]))
  const colFieldMap = buildColumnFieldMap(headers, fieldByName)

  const existing = await fetchAllContacts()
  const byPod = indexByPodPdr(existing)

  yield { type: 'start', total: rows.length }

  let created = 0, updated = 0, untagged = 0, unmatched = 0, skipped = 0
  let done = 0

  await pmap(rows, async (row) => {
    const pod = (row[COL.PodPdr] || '').toUpperCase().trim()
    if (!pod) {
      skipped++; done++; return
    }
    const cliente = (row[COL.Cliente] || '').trim()

    // Build customField payload from every CSV column that maps to a known field.
    const cf: Record<string, string | number> = {}
    for (const [colName, fieldId] of colFieldMap) {
      const v = row[colName]
      if (v == null || v === '') continue
      cf[fieldId] = v
    }

    const existingContact = byPod.get(pod)
    const wasSwitchedOut = existingContact?.tags?.includes(APULIA_TAG.SWITCH_OUT)

    try {
      if (existingContact) {
        await upsertContact({
          id: existingContact.id,
          firstName: cliente || existingContact.firstName,
          customField: cf,
        })
        if (wasSwitchedOut) {
          await removeTag(existingContact.id, APULIA_TAG.SWITCH_OUT)
          untagged++
        }
        updated++
      } else {
        await upsertContact({
          email: (row[COL.Email] || '').trim() || undefined,
          phone: sanitizePhone(row[COL.Mobile] || row[COL.Phone]),
          firstName: cliente || pod,
          customField: cf,
        })
        created++
      }
    } catch (err) {
      console.error(`[importPdp] row failed (POD ${pod}):`, err)
      unmatched++
    } finally {
      done++
    }
  }, 8)

  // Periodically yield progress isn't simple inside pmap; emit aggregate then.
  yield { type: 'progress', done, total: rows.length, created, updated, untagged, unmatched, skipped }

  yield { type: 'recompute' }
  const recompute = await recomputeCommissions()

  yield {
    type: 'done',
    created,
    updated,
    untagged,
    unmatched,
    skipped,
    recompute,
    durationMs: Date.now() - startedAt,
  }
}

function sanitizePhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const digits = String(raw).replace(/[^\d+]/g, '')
  if (!digits || /^0+$/.test(digits)) return undefined
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('00')) return '+' + digits.slice(2)
  if (digits.startsWith('39')) return '+' + digits
  return '+39' + digits
}

// Re-export for callers that need types
export type { ApuliaContact }
