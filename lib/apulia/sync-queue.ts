import { createAdminClient } from '@/lib/supabase-server'

export type QueueAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'add_tag'
  | 'remove_tag'
  | 'set_field'

export interface QueueOpInput {
  /** Bibot row id (apulia_contacts.id). Always set. */
  contact_id: string
  /** GHL contact id, if known. NULL for pending_create rows the worker hasn't pushed yet. */
  ghl_id?: string | null
  action: QueueAction
  /** Action-specific payload — see worker for shape per action. */
  payload?: unknown
  /** Optional: if this op was created by a bulk import, the apulia_imports.id. */
  import_id?: string | null
}

/**
 * Insert one or many sync ops onto the outbound queue. Caller is responsible
 * for setting the corresponding row's sync_status (pending_create / pending_update
 * / pending_delete) before enqueuing.
 *
 * The optional `defaultImportId` is convenient for bulk importers: every op
 * in the array inherits it unless the op explicitly sets its own.
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
    const { error } = await sb.from('apulia_sync_queue').insert(rows.slice(i, i + CHUNK))
    if (error) throw new Error(`enqueueOps insert ${i}: ${error.message}`)
  }
}

export async function enqueueOp(op: QueueOpInput): Promise<void> {
  await enqueueOps([op])
}
