/**
 * Sync each contact's loyalty tier to a GHL tag (livello-<tier>) so automations
 * can target tiers. Tier is derived from orders_count + total_spent_cents under
 * the current segment config; we diff against the stored `tier` column and only
 * enqueue tag changes when it moves. Runs after an import (affected contacts)
 * and after the owner edits thresholds (all contacts) — incremental via the
 * sync queue, so it's rate-limit-safe.
 */

import { createAdminClient } from '@/lib/supabase-server'
import { enqueueOps, type QueueOpInput } from './sync-queue'
import { computeTier, tierTag, type SegmentConfig } from './segments'
import { getSegmentConfig } from './segments-store'

interface TierRow {
  id: string
  ghl_id: string | null
  tags: string[] | null
  orders_count: number
  total_spent_cents: number
  tier: string | null
}

const COLS = 'id, ghl_id, tags, orders_count, total_spent_cents, tier'

const RETAG_KEY = 'retag_pending'

/** Flag that thresholds changed so the next drain re-tags everyone (background). */
export async function markRetagPending(): Promise<void> {
  const sb = createAdminClient()
  await sb.from('farmacia_settings').upsert({ key: RETAG_KEY, value: true, updated_at: new Date().toISOString() }, { onConflict: 'key' })
}

/** If a re-tag is pending, clear the flag and run the full tier-tag pass. */
export async function runPendingRetag(): Promise<{ updated: number } | null> {
  const sb = createAdminClient()
  const { data } = await sb.from('farmacia_settings').select('value').eq('key', RETAG_KEY).maybeSingle()
  if (data?.value !== true) return null
  await sb.from('farmacia_settings').upsert({ key: RETAG_KEY, value: false, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  return applyTierTags()
}

/** Recompute tiers and enqueue GHL tag changes for the contacts whose tier moved. */
export async function applyTierTags(contactIds?: string[]): Promise<{ updated: number }> {
  const sb = createAdminClient()
  const config: SegmentConfig = await getSegmentConfig()
  let updated = 0

  const process = async (rows: TierRow[]) => {
    const ops: QueueOpInput[] = []
    for (const row of rows) {
      const desired = computeTier(row.orders_count ?? 0, row.total_spent_cents ?? 0, config)?.name ?? null
      if (desired === (row.tier ?? null)) continue

      const oldTag = row.tier ? tierTag(row.tier) : null
      const newTag = desired ? tierTag(desired) : null
      // Local tags: strip every tier tag, add the new one.
      const tags = (row.tags ?? []).filter((t) => !t.startsWith('livello-'))
      if (newTag) tags.push(newTag)

      await sb.from('farmacia_contacts').update({ tier: desired, tags }).eq('id', row.id)
      updated++

      // Only enqueue GHL tag ops once the contact exists in GHL; a not-yet-
      // created contact carries the tier tag in its create body (tags array).
      if (row.ghl_id) {
        if (oldTag && oldTag !== newTag) ops.push({ contact_id: row.id, ghl_id: row.ghl_id, action: 'remove_tag', payload: { tag: oldTag } })
        if (newTag && newTag !== oldTag) ops.push({ contact_id: row.id, ghl_id: row.ghl_id, action: 'add_tag', payload: { tag: newTag } })
      }
    }
    if (ops.length) await enqueueOps(ops)
  }

  if (contactIds && contactIds.length) {
    for (let i = 0; i < contactIds.length; i += 300) {
      const { data } = await sb.from('farmacia_contacts').select(COLS).in('id', contactIds.slice(i, i + 300))
      await process((data ?? []) as TierRow[])
    }
  } else {
    // Full pass, paginated.
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data } = await sb.from('farmacia_contacts').select(COLS).range(from, from + PAGE - 1)
      const rows = (data ?? []) as TierRow[]
      if (!rows.length) break
      await process(rows)
      if (rows.length < PAGE) break
    }
  }

  return { updated }
}
