import { upsertContact } from './contacts'
import { upsertCachedFromGhl } from './cache'
import { APULIA_FIELD } from './fields'
import { createAdminClient } from '@/lib/supabase-server'

export type AdminImportEvent =
  | { type: 'preflight' }
  | { type: 'start'; total: number }
  | { type: 'progress'; done: number; total: number; created: number; updated: number; skipped: number }
  | { type: 'done'; created: number; updated: number; skipped: number; durationMs: number }
  | { type: 'error'; message: string }

const COL = {
  Name: 'Fornitura : Cliente : Amministratore condominio',
  Code: 'Fornitura : Cliente : Codice amministratore',
  CF: 'Fornitura : Cliente : Amministratore condominio : Codice fiscale Amministratore',
  PIVA: 'Fornitura : Cliente : Amministratore condominio : Partita IVA',
  Phone: 'Fornitura : Cliente : Numero Telefono Amministratore',
  Email: 'Fornitura : Dati di fatturazione : Email',
  Address: 'Fornitura : Dati di fatturazione : Indirizzo',
  City: 'Fornitura : Dati di fatturazione : Indirizzo (Città)',
  Province: 'Fornitura : Dati di fatturazione : Indirizzo (Stato/Provincia)',
  Compenso: 'compenso per ciascun pod',
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

export async function* importAdmins(rows: Record<string, string>[]): AsyncGenerator<AdminImportEvent> {
  const startedAt = Date.now()
  yield { type: 'preflight' }
  const sb = createAdminClient()

  // Existing admins indexed by code (so we update rather than duplicate).
  const codes = new Set<string>()
  for (const r of rows) {
    const code = (r[COL.Code] || '').trim()
    if (code) codes.add(code)
  }
  const { data: existing } = codes.size
    ? await sb.from('apulia_contacts').select('id, codice_amministratore').eq('is_amministratore', true).in('codice_amministratore', [...codes])
    : { data: [] }
  const idByCode = new Map((existing ?? []).map((a) => [a.codice_amministratore, a.id]))

  yield { type: 'start', total: rows.length }
  let created = 0, updated = 0, skipped = 0, done = 0

  for (const row of rows) {
    const name = (row[COL.Name] || '').trim()
    const code = (row[COL.Code] || '').trim()
    if (!name || !code) { skipped++; done++; continue }

    const cf: Record<string, string | number> = {
      [APULIA_FIELD.AMMINISTRATORE_CONDOMINIO]: name,
      [APULIA_FIELD.CODICE_AMMINISTRATORE]: code,
    }
    if (row[COL.CF]) cf[APULIA_FIELD.CODICE_FISCALE_AMMINISTRATORE] = row[COL.CF]
    if (row[COL.PIVA]) cf[APULIA_FIELD.PARTITA_IVA_AMMINISTRATORE] = row[COL.PIVA]
    if (row[COL.Phone]) cf[APULIA_FIELD.TELEFONO_AMMINISTRATORE] = row[COL.Phone]
    if (row[COL.Email]) cf[APULIA_FIELD.EMAIL_BILLING] = row[COL.Email]
    if (row[COL.Address]) cf['oCvfwCelHDn6gWEljqUJ'] = row[COL.Address]
    if (row[COL.City]) cf['EXO9WD4aLV2aPiMYxXUU'] = row[COL.City]
    if (row[COL.Province]) cf['opaPQWrWwDiaAeyoMbN5'] = row[COL.Province]
    const compenso = row[COL.Compenso] ? Number(String(row[COL.Compenso]).replace(',', '.')) : null
    if (compenso != null && Number.isFinite(compenso) && compenso > 0) cf[APULIA_FIELD.COMPENSO_PER_POD] = compenso

    try {
      const id = idByCode.get(code)
      if (id) {
        await upsertContact({ id, firstName: name, customField: cf })
        // Also keep cache row in sync.
        await upsertCachedFromGhl({
          id,
          firstName: name,
          email: row[COL.Email] || undefined,
          phone: sanitizePhone(row[COL.Phone]),
          tags: ['amministratore'],
          customFields: Object.entries(cf).map(([cid, v]) => ({ id: cid, value: String(v) })),
        })
        updated++
      } else {
        const newId = await upsertContact({
          email: row[COL.Email] || undefined,
          phone: sanitizePhone(row[COL.Phone]),
          firstName: name,
          tags: ['amministratore'],
          customField: cf,
        })
        if (newId) {
          await upsertCachedFromGhl({
            id: newId,
            firstName: name,
            email: row[COL.Email] || undefined,
            phone: sanitizePhone(row[COL.Phone]),
            tags: ['amministratore'],
            customFields: Object.entries(cf).map(([cid, v]) => ({ id: cid, value: String(v) })),
          })
          await sb.from('apulia_contacts').update({ first_payment_at: new Date().toISOString() }).eq('id', newId)
          idByCode.set(code, newId)
          created++
        }
      }
    } catch (err) {
      console.error(`[importAdmins] code ${code}:`, err)
      skipped++
    }
    done++
  }

  yield { type: 'progress', done, total: rows.length, created, updated, skipped }
  yield { type: 'done', created, updated, skipped, durationMs: Date.now() - startedAt }
}
