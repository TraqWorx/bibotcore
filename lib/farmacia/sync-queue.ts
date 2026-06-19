import { createAdminClient } from '@/lib/supabase-server'

export type QueueAction = 'create' | 'update' | 'delete' | 'add_tag' | 'remove_tag' | 'set_field'

export interface QueueOpInput {
  /** Bibot row id (farmacia_contacts.id). */
  contact_id: string
  /** GHL contact id, if known. NULL for pending_create rows not yet pushed. */
  ghl_id?: string | null
  action: QueueAction
  payload?: unknown
  /** farmacia_imports.id if this op came from a bulk import. */
  import_id?: string | null
}

/**
 * Insert sync ops onto the outbound queue (farmacia_sync_queue). Caller sets the
 * row's sync_status before enqueuing. Mirrors lib/apulia/sync-queue.ts.
 */
export async function enqueueOps(ops: QueueOpInput[], defaultImportId?: string | null): Promise<void> {
  if (ops.length === 0) return
  const sb = createAdminClient()
  const rows = ops.map((o) => ({
    contact_id: o.contact_id,
    ghl_id: o.ghl_id ?? null,
    action: o.action,
    payload: o.payload ?? null,
    import_id: o.import_id ?? defaultImportId ?? null,
  }))
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await sb.from('farmacia_sync_queue').insert(rows.slice(i, i + CHUNK))
    if (error) throw new Error(`enqueueOps insert ${i}: ${error.message}`)
  }
}

export async function enqueueOp(op: QueueOpInput): Promise<void> {
  await enqueueOps([op])
}
