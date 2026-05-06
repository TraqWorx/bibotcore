import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase-server'
import { APULIA_FIELD, APULIA_TAG } from './fields'
import { enqueueOps, type QueueOpInput } from './sync-queue'

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

interface ExistingAdmin {
  id: string
  ghl_id: string | null
  codice_amministratore: string
  custom_fields: Record<string, string> | null
  tags: string[] | null
}

/**
 * DB-first admins import. Looks up existing admins by codice_amministratore
 * in apulia_contacts, UPDATEs in place + enqueues an 'update' op, or INSERTs
 * a fresh uuid row with sync_status='pending_create' + 'create' op.
 *
 * Yields the same event shape as the old GHL-first version so the route
 * handler streaming UI stays identical.
 */
export async function* importAdmins(rows: Record<string, string>[], importId?: string | null): AsyncGenerator<AdminImportEvent> {
  const startedAt = Date.now()
  yield { type: 'preflight' }
  const sb = createAdminClient()

  const codes = new Set<string>()
  for (const r of rows) {
    const code = (r[COL.Code] || '').trim()
    if (code) codes.add(code)
  }

  const { data: existingRaw } = codes.size
    ? await sb
        .from('apulia_contacts')
        .select('id, ghl_id, codice_amministratore, custom_fields, tags')
        .eq('is_amministratore', true)
        .neq('sync_status', 'pending_delete')
        .in('codice_amministratore', [...codes])
    : { data: [] as ExistingAdmin[] }
  const byCode = new Map((existingRaw as ExistingAdmin[] | null ?? []).map((a) => [a.codice_amministratore, a]))

  yield { type: 'start', total: rows.length }
  let created = 0, updated = 0, skipped = 0, done = 0

  const inserts: Record<string, unknown>[] = []
  const updates: Record<string, unknown>[] = []
  const ops: QueueOpInput[] = []

  for (const row of rows) {
    const name = (row[COL.Name] || '').trim()
    const code = (row[COL.Code] || '').trim()
    if (!name || !code) { skipped++; done++; continue }

    const cf: Record<string, string> = {
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
    if (compenso != null && Number.isFinite(compenso) && compenso > 0) {
      cf[APULIA_FIELD.COMPENSO_PER_POD] = String(compenso)
    }
    const compensoNum = compenso != null && Number.isFinite(compenso) && compenso > 0 ? compenso : null

    const existing = byCode.get(code)
    if (existing) {
      const mergedCf: Record<string, string> = { ...(existing.custom_fields ?? {}), ...cf }
      const tags = Array.from(new Set([...(existing.tags ?? []), APULIA_TAG.AMMINISTRATORE]))
      updates.push({
        id: existing.id,
        first_name: name,
        tags,
        custom_fields: mergedCf,
        codice_amministratore: code,
        amministratore_name: name,
        compenso_per_pod: compensoNum ?? null,
        is_amministratore: true,
        sync_status: 'pending_update',
      })
      ops.push({ contact_id: existing.id, ghl_id: existing.ghl_id ?? null, action: 'update' })
      updated++
    } else {
      const id = randomUUID()
      inserts.push({
        id,
        ghl_id: null,
        sync_status: 'pending_create',
        email: row[COL.Email] || null,
        phone: sanitizePhone(row[COL.Phone]) ?? null,
        first_name: name,
        last_name: null,
        tags: [APULIA_TAG.AMMINISTRATORE],
        custom_fields: cf,
        pod_pdr: null,
        codice_amministratore: code,
        amministratore_name: name,
        cliente: null,
        comune: row[COL.City] || null,
        stato: null,
        compenso_per_pod: compensoNum,
        pod_override: null,
        commissione_totale: null,
        is_amministratore: true,
        is_switch_out: false,
        ghl_updated_at: null,
      })
      ops.push({ contact_id: id, ghl_id: null, action: 'create' })
      byCode.set(code, { id, ghl_id: null, codice_amministratore: code, custom_fields: cf, tags: [APULIA_TAG.AMMINISTRATORE] })
      created++
    }
    done++
    if (done % 50 === 0) {
      yield { type: 'progress', done, total: rows.length, created, updated, skipped }
    }
  }

  // Defensive dedup: collapse inserts by codice_amministratore so we can
  // never produce two pending_create rows for the same code, regardless
  // of whether the in-loop byCode lookup somehow missed a match. Any
  // dropped rows turn into UPDATE ops on the kept row instead.
  const insertsByCode = new Map<string, Record<string, unknown>>()
  const droppedDupes: Array<{ kept: Record<string, unknown>; dropped: Record<string, unknown> }> = []
  for (const ins of inserts) {
    const code = ins.codice_amministratore as string | null
    if (!code) { /* shouldn't happen — admin without code was skipped */ continue }
    const existing = insertsByCode.get(code)
    if (!existing) { insertsByCode.set(code, ins); continue }
    droppedDupes.push({ kept: existing, dropped: ins })
  }
  if (droppedDupes.length > 0) {
    console.warn(`[importAdmins] In-loop dedup missed ${droppedDupes.length} duplicate code(s); collapsing as final pass.`)
    // Cancel the dropped rows' create ops in our local ops list (they
    // would have referenced contact_ids that won't exist after dedup).
    const droppedIds = new Set(droppedDupes.map((d) => d.dropped.id as string))
    for (let i = ops.length - 1; i >= 0; i--) {
      if (droppedIds.has(ops[i].contact_id)) ops.splice(i, 1)
    }
    // For each dropped row, fold its values into an UPDATE on the kept row
    // so the data still gets written (kept row's payload + dropped row's
    // custom fields merged).
    for (const { kept, dropped } of droppedDupes) {
      const keptCf = (kept.custom_fields as Record<string, string> | null) ?? {}
      const droppedCf = (dropped.custom_fields as Record<string, string> | null) ?? {}
      const mergedCf = { ...keptCf, ...droppedCf }
      kept.custom_fields = mergedCf
    }
  }
  const finalInserts = [...insertsByCode.values()]

  // Persist DB writes.
  const CHUNK = 500
  if (finalInserts.length) {
    for (let i = 0; i < finalInserts.length; i += CHUNK) {
      const slice = finalInserts.slice(i, i + CHUNK)
      const { error } = await sb.from('apulia_contacts').insert(slice)
      if (error) throw new Error(`admins insert ${i}: ${error.message}`)
    }
  }
  if (updates.length) {
    for (let i = 0; i < updates.length; i += CHUNK) {
      const slice = updates.slice(i, i + CHUNK)
      const { error } = await sb.from('apulia_contacts').upsert(slice, { onConflict: 'id' })
      if (error) throw new Error(`admins update ${i}: ${error.message}`)
    }
  }
  await enqueueOps(ops, importId ?? null)
  // Adjust the reported counter: collapsed dupes shouldn't count as creates.
  created -= droppedDupes.length

  yield { type: 'progress', done, total: rows.length, created, updated, skipped }
  yield { type: 'done', created, updated, skipped, durationMs: Date.now() - startedAt }
}
