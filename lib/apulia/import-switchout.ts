import { createAdminClient } from '@/lib/supabase-server'
import { APULIA_TAG } from './fields'
import { normalizePod } from './cache'
import { recomputeCommissions, type RecomputeResult } from './recompute'
import { enqueueOps, type QueueOpInput } from './sync-queue'

export type SwitchOutEvent =
  | { type: 'preflight' }
  | { type: 'start'; total: number }
  | { type: 'progress'; done: number; total: number; tagged: number; alreadyTagged: number; unmatched: number; skipped: number }
  | { type: 'recompute' }
  | { type: 'done'; tagged: number; alreadyTagged: number; unmatched: number; skipped: number; recompute: RecomputeResult; durationMs: number }
  | { type: 'error'; message: string }

const POD_COL_CANDIDATES = ['Pod Pdr', 'POD/PDR', 'POD PDR']

interface ExistingPod {
  id: string
  ghl_id: string | null
  pod_pdr: string | null
  tags: string[] | null
  is_switch_out: boolean
}

/**
 * DB-first switch-out import. Looks up condomini in apulia_contacts by
 * pod_pdr; rows that aren't yet switch_out get the SWITCH_OUT tag added,
 * sync_status flipped to pending_update, and an 'add_tag' op enqueued.
 *
 * Final commission recompute runs synchronously (DB-only).
 */
export async function* importSwitchOut(rows: Record<string, string>[], importId?: string | null): AsyncGenerator<SwitchOutEvent> {
  const startedAt = Date.now()
  yield { type: 'preflight' }

  const sb = createAdminClient()
  const podColumn = POD_COL_CANDIDATES.find((c) => rows[0] && c in rows[0])

  const podsInFile: string[] = []
  for (const row of rows) {
    const raw = podColumn ? (row[podColumn] || '').toUpperCase().trim() : ''
    const norm = normalizePod(raw)
    if (norm) podsInFile.push(norm)
  }

  // Pull every condomino touched by this file. PostgREST caps a single
  // .in() at 1000 results — we batch the lookup in chunks of 500 PODs
  // so a 4000-row switch-out file doesn't silently mis-classify the
  // tail as "unmatched".
  const uniquePods = [...new Set(podsInFile)]
  const existing: ExistingPod[] = []
  const LOOKUP_CHUNK = 500
  for (let i = 0; i < uniquePods.length; i += LOOKUP_CHUNK) {
    const slice = uniquePods.slice(i, i + LOOKUP_CHUNK)
    const { data } = await sb
      .from('apulia_contacts')
      .select('id, ghl_id, pod_pdr, tags, is_switch_out')
      .eq('is_amministratore', false)
      .neq('sync_status', 'pending_delete')
      .in('pod_pdr', slice)
    if (data) existing.push(...(data as ExistingPod[]))
  }
  const byPod = new Map(existing
    .filter((r) => r.pod_pdr)
    .map((r) => [r.pod_pdr as string, r]))

  yield { type: 'start', total: rows.length }
  let tagged = 0, alreadyTagged = 0, unmatched = 0, skipped = 0, done = 0

  const updates: Record<string, unknown>[] = []
  const ops: QueueOpInput[] = []

  for (const row of rows) {
    const raw = podColumn ? (row[podColumn] || '').toUpperCase().trim() : ''
    const pod = normalizePod(raw)
    if (!pod) { skipped++; done++; continue }
    const c = byPod.get(pod)
    if (!c) { unmatched++; done++; continue }
    if (c.is_switch_out || (c.tags ?? []).includes(APULIA_TAG.SWITCH_OUT)) {
      alreadyTagged++; done++; continue
    }
    const newTags = Array.from(new Set([...(c.tags ?? []), APULIA_TAG.SWITCH_OUT]))
    updates.push({ id: c.id, tags: newTags, is_switch_out: true, sync_status: 'pending_update' })
    ops.push({
      contact_id: c.id,
      ghl_id: c.ghl_id ?? null,
      action: 'add_tag',
      payload: { tag: APULIA_TAG.SWITCH_OUT },
    })
    tagged++
    done++
    if (done % 100 === 0) {
      yield { type: 'progress', done, total: rows.length, tagged, alreadyTagged, unmatched, skipped }
    }
  }

  // Dedup updates by id so two file rows pointing at the same Bibot row
  // don't blow up the upsert (Postgres rejects two identical conflict
  // targets in the same statement).
  const updatesById = new Map<string, Record<string, unknown>>()
  for (const u of updates) {
    updatesById.set(u.id as string, u)
  }
  const finalUpdates = [...updatesById.values()]

  const CHUNK = 500
  if (finalUpdates.length) {
    for (let i = 0; i < finalUpdates.length; i += CHUNK) {
      const slice = finalUpdates.slice(i, i + CHUNK)
      const { error } = await sb.from('apulia_contacts').upsert(slice, { onConflict: 'id' })
      if (error) throw new Error(`switch-out update ${i}: ${error.message}`)
    }
  }
  await enqueueOps(ops, importId ?? null)

  yield { type: 'progress', done, total: rows.length, tagged, alreadyTagged, unmatched, skipped }
  yield { type: 'recompute' }
  const recompute = await recomputeCommissions()

  yield { type: 'done', tagged, alreadyTagged, unmatched, skipped, recompute, durationMs: Date.now() - startedAt }
}
