import { createAdminClient } from '@/lib/supabase-server'

export type ImportRowOutcome =
  | 'created'
  | 'updated'
  | 'reactivated'
  | 'skipped'
  | 'duplicate'
  | 'tagged'
  | 'already'
  | 'unmatched'

export interface ImportRowEvent {
  identifier?: string | null
  label?: string | null
  outcome: ImportRowOutcome
  reason?: string | null
  contactId?: string | null
  rowIndex?: number | null
}

/**
 * Persist per-row outcomes for an import so the UI can show every file row with
 * its status. Best-effort: any failure is swallowed so it can NEVER break the
 * import itself. No-op when there is no importId (ad-hoc runs).
 */
export async function recordImportRows(
  importId: string | null | undefined,
  rows: ImportRowEvent[],
): Promise<void> {
  if (!importId || rows.length === 0) return
  try {
    const sb = createAdminClient()
    const payload = rows.map((r) => ({
      import_id: importId,
      row_index: r.rowIndex ?? null,
      identifier: r.identifier ?? null,
      label: r.label ?? null,
      outcome: r.outcome,
      reason: r.reason ?? null,
      contact_id: r.contactId ?? null,
    }))
    for (let i = 0; i < payload.length; i += 500) {
      await sb.from('apulia_import_rows').insert(payload.slice(i, i + 500))
    }
  } catch (err) {
    console.error('[importRows] failed to record (import not affected):', err)
  }
}
