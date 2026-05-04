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
  // Admin profile data (used when auto-creating an admin contact on first sight)
  AdminName: 'Fornitura : Cliente : Amministratore condominio',
  AdminCF: 'Fornitura : Cliente : Amministratore condominio : Codice fiscale Amministratore',
  AdminPIVA: 'Fornitura : Cliente : Amministratore condominio : Partita IVA',
  AdminPhone: 'Fornitura : Cliente : Numero Telefono Amministratore',
  AdminEmail: 'Fornitura : Dati di fatturazione : Email',
  AdminAddress: 'Fornitura : Dati di fatturazione : Indirizzo',
  AdminCity: 'Fornitura : Dati di fatturazione : Indirizzo (Città)',
  AdminProv: 'Fornitura : Dati di fatturazione : Indirizzo (Stato/Provincia)',
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
    const podRaw = (row[COL.PodPdr] || '').toUpperCase().trim()
    // Excel often serialises numeric PODs in scientific notation; expand.
    const pod = /^[+-]?\d+(\.\d+)?[Ee][+-]?\d+$/.test(podRaw)
      ? Number(podRaw).toFixed(0)
      : podRaw
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

  // Auto-create admin contacts for any new Codice amministratore in this
  // CSV that doesn't yet have an `amministratore`-tagged contact. Stamp
  // first_payment_at = now on every admin (newly created or pre-existing
  // without an anchor).
  try {
    const { createAdminClient } = await import('@/lib/supabase-server')
    const { upsertContact } = await import('./contacts')
    const { upsertCachedFromGhl } = await import('./cache')
    const sb = createAdminClient()

    // Build map: code → first row data (used as admin profile source).
    const firstRowByCode = new Map<string, Record<string, string>>()
    for (const row of rows) {
      const code = (row[COL.CodiceAmm] || '').trim()
      if (code && !firstRowByCode.has(code)) firstRowByCode.set(code, row)
    }
    if (firstRowByCode.size === 0) {
      // nothing to do
    } else {
      // Look up which codes already have an admin contact in the cache.
      const { data: existingAdmins } = await sb
        .from('apulia_contacts')
        .select('id, codice_amministratore, first_payment_at')
        .eq('is_amministratore', true)
        .in('codice_amministratore', [...firstRowByCode.keys()])
      const existingByCode = new Map((existingAdmins ?? []).map((a) => [a.codice_amministratore, a]))
      const now = new Date().toISOString()

      for (const [code, row] of firstRowByCode) {
        const existing = existingByCode.get(code)
        if (existing) {
          // Stamp first_payment_at if missing.
          if (!existing.first_payment_at) {
            await sb.from('apulia_contacts').update({ first_payment_at: now }).eq('id', existing.id)
          }
          continue
        }
        // Create the admin contact in Bibot.
        const adminName = (row[COL.AdminName] || '').trim() || `Amministratore ${code}`
        const cf: Record<string, string | number> = {}
        for (const [colName, fieldId] of colFieldMap) {
          const v = row[colName]
          if (v == null || v === '') continue
          // Only carry admin-relevant fields, skip POD-specific ones.
          // Simplest: include all that map; harmless on contact.
          cf[fieldId] = v
        }
        try {
          const newId = await upsertContact({
            email: (row[COL.AdminEmail] || '').trim() || undefined,
            phone: sanitizePhone(row[COL.AdminPhone]),
            firstName: adminName,
            tags: ['amministratore'],
            customField: cf,
          })
          if (newId) {
            await upsertCachedFromGhl({
              id: newId,
              firstName: adminName,
              tags: ['amministratore'],
              customFields: Object.entries(cf).map(([id, value]) => ({ id, value: String(value) })),
            })
            await sb.from('apulia_contacts').update({ first_payment_at: now }).eq('id', newId)
          }
        } catch (err) {
          console.error(`[importPdp] auto-create admin ${code} failed:`, err)
        }
      }
    }
  } catch (err) {
    console.error('[importPdp] admin auto-create:', err)
  }

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
