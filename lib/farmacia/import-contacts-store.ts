/** Persist a validated channel-box contact import: dedup by phone, add the box
 *  tag (keeping existing tags), and enqueue GHL sync so the tag triggers the
 *  nurturing automation. Server-only. */

import { createAdminClient } from '@/lib/supabase-server'
import { enqueueOps, type QueueOpInput } from './sync-queue'
import { FARMACIA_TAG } from './fields'
import { type ImportBox, type ValidContact } from './import-contacts'

function newId(): string { return globalThis.crypto.randomUUID() }
function chunked<T>(a: T[], n: number): T[][] { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }

export interface ContactImportResult { imported: number; created: number; updated: number }

export async function persistContactImport(valid: ValidContact[], box: ImportBox, importId: string | null): Promise<ContactImportResult> {
  const sb = createAdminClient()
  const tag = box // 'amazon' | 'ebay' | 'store' — the tag GHL automations watch
  let created = 0
  let updated = 0
  const ops: QueueOpInput[] = []

  // Existing contacts by phone.
  const existing = new Map<string, { id: string; tags: string[] | null; origin_tags: string[] | null; ghl_id: string | null }>()
  const phones = valid.map((v) => v.phoneNorm)
  for (const chunk of chunked(phones, 300)) {
    const { data } = await sb.from('farmacia_contacts').select('id, phone_norm, tags, origin_tags, ghl_id').in('phone_norm', chunk)
    for (const r of data ?? []) if (r.phone_norm) existing.set(r.phone_norm, r)
  }

  for (const v of valid) {
    const ex = existing.get(v.phoneNorm)
    if (ex) {
      const tags = [...new Set([...(ex.tags ?? []), FARMACIA_TAG.CUSTOMER, tag])]
      const originTags = [...new Set([...(ex.origin_tags ?? []), box])]
      await sb.from('farmacia_contacts').update({ tags, origin_tags: originTags }).eq('id', ex.id)
      // Existing GHL contact → add the tag (triggers the automation). Not-yet-
      // synced rows carry the tag in their pending create body, so no op needed.
      if (ex.ghl_id) ops.push({ contact_id: ex.id, ghl_id: ex.ghl_id, action: 'add_tag', payload: { tag }, import_id: importId })
      updated++
    } else {
      const id = newId()
      await sb.from('farmacia_contacts').insert({
        id, phone_norm: v.phoneNorm, phone: v.phoneNorm, email: v.email,
        first_name: v.firstName, last_name: v.lastName,
        tags: [FARMACIA_TAG.CUSTOMER, tag], origin_tags: [box], sync_status: 'pending_create',
      })
      ops.push({ contact_id: id, action: 'create', import_id: importId })
      existing.set(v.phoneNorm, { id, tags: [FARMACIA_TAG.CUSTOMER, tag], origin_tags: [box], ghl_id: null })
      created++
    }
  }

  if (ops.length) await enqueueOps(ops, importId)
  return { imported: created + updated, created, updated }
}
