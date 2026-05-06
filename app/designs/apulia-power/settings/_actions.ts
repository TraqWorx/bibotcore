'use server'

import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { fullSyncCache } from '@/lib/apulia/cache'
import { enqueueOps } from '@/lib/apulia/sync-queue'

async function ensureOwner(): Promise<{ email: string } | { error: string }> {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  if (profile?.role === 'super_admin') return { email: user.email ?? '' }
  if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) return { error: 'Forbidden' }
  if (profile.role !== 'admin') return { error: 'Forbidden' }
  return { email: user.email ?? '' }
}

export async function setPayoutSchedule(h1: string, h2: string): Promise<{ error: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard
  if (!/^\d{2}-\d{2}$/.test(h1) || !/^\d{2}-\d{2}$/.test(h2)) {
    return { error: 'Formato data deve essere MM-DD' }
  }
  const sb = createAdminClient()
  const { error } = await sb.from('apulia_settings').upsert(
    { key: 'payout_schedule', value: { H1: h1, H2: h2 }, updated_at: new Date().toISOString(), updated_by: guard.email },
    { onConflict: 'key' },
  )
  if (error) return { error: error.message }
  revalidatePath('/designs/apulia-power/settings')
  revalidatePath('/designs/apulia-power/dashboard')
}

export async function resyncCache(): Promise<{ total: number; deleted: number; error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return { total: 0, deleted: 0, error: guard.error }
  try {
    const r = await fullSyncCache()
    revalidatePath('/designs/apulia-power/dashboard', 'layout')
    return r
  } catch (err) {
    return { total: 0, deleted: 0, error: err instanceof Error ? err.message : 'failed' }
  }
}

export interface SyncQueueStats {
  pending: number
  inProgress: number
  failed: number
  completedLast24h: number
  oldestPendingMinutes: number | null
}

/** Read counts for the Sync queue panel. */
export async function getSyncQueueStats(): Promise<SyncQueueStats | { error: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { error: guard.error }
  const sb = createAdminClient()

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [pending, inProgress, failed, completed24h, oldest] = await Promise.all([
    sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
    sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', dayAgo),
    sb.from('apulia_sync_queue').select('created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(1).maybeSingle(),
  ])

  const oldestPendingMinutes = oldest.data?.created_at
    ? Math.round((Date.now() - new Date(oldest.data.created_at as string).getTime()) / 60_000)
    : null

  return {
    pending: pending.count ?? 0,
    inProgress: inProgress.count ?? 0,
    failed: failed.count ?? 0,
    completedLast24h: completed24h.count ?? 0,
    oldestPendingMinutes,
  }
}

export interface SyncImportSummary {
  importId: string | null
  kind: string | null
  filename: string | null
  startedAt: string | null
  totalOps: number
  pending: number
  inProgress: number
  completed: number
  failed: number
}

/**
 * One row per bulk import (plus an "ad-hoc" bucket for manual server-action
 * ops with import_id NULL). Each row shows op-status counts so the user
 * can see "this import: 3949 ops, 3940 synced, 9 failed".
 */
export async function listSyncImports(): Promise<SyncImportSummary[] | { error: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { error: guard.error }
  const sb = createAdminClient()

  // Pull the imports themselves so we have file/kind/start time. Last 50.
  const { data: imports } = await sb
    .from('apulia_imports')
    .select('id, kind, filename, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  // Pull every op count grouped by import_id + status. PostgREST caps
  // a single query at db-max-rows (1000 in our config), so paginate
  // until we've seen everything. Done client-side because supabase-js
  // doesn't expose GROUP BY without a custom RPC.
  const opRows: Array<{ import_id: string | null; status: string }> = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from('apulia_sync_queue')
      .select('import_id, status')
      .range(from, from + 999)
    if (!data || data.length === 0) break
    opRows.push(...(data as Array<{ import_id: string | null; status: string }>))
    if (data.length < 1000) break
  }

  const counts = new Map<string, { pending: number; inProgress: number; completed: number; failed: number; total: number }>()
  for (const r of opRows ?? []) {
    const key = (r.import_id as string | null) ?? '__manual__'
    let c = counts.get(key)
    if (!c) { c = { pending: 0, inProgress: 0, completed: 0, failed: 0, total: 0 }; counts.set(key, c) }
    c.total++
    if (r.status === 'pending') c.pending++
    else if (r.status === 'in_progress') c.inProgress++
    else if (r.status === 'completed') c.completed++
    else if (r.status === 'failed') c.failed++
  }

  const summaries: SyncImportSummary[] = []
  for (const imp of imports ?? []) {
    const c = counts.get(imp.id) ?? { pending: 0, inProgress: 0, completed: 0, failed: 0, total: 0 }
    if (c.total === 0) continue // skip imports that didn't enqueue ops
    summaries.push({
      importId: imp.id,
      kind: imp.kind,
      filename: imp.filename,
      startedAt: imp.created_at,
      totalOps: c.total,
      pending: c.pending,
      inProgress: c.inProgress,
      completed: c.completed,
      failed: c.failed,
    })
  }
  // Manual bucket
  const manual = counts.get('__manual__')
  if (manual && manual.total > 0) {
    summaries.unshift({
      importId: null,
      kind: 'manual',
      filename: null,
      startedAt: null,
      totalOps: manual.total,
      pending: manual.pending,
      inProgress: manual.inProgress,
      completed: manual.completed,
      failed: manual.failed,
    })
  }
  return summaries
}

export interface SyncOpDetail {
  id: string
  action: string
  status: string
  attempts: number
  contactId: string | null
  contactName: string | null
  contactCode: string | null
  contactPod: string | null
  ghlId: string | null
  lastError: string | null
  lastAttemptAt: string | null
  completedAt: string | null
}

/**
 * Pull the queue ops for one import (or for the ad-hoc bucket when
 * importId is null). Joins each op with its contact's display fields so
 * the panel can show "DI FRATTA ADELE (code 14459571) — failed".
 */
export async function getSyncOpsForImport(importId: string | null): Promise<SyncOpDetail[] | { error: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { error: guard.error }
  const sb = createAdminClient()

  let q = sb
    .from('apulia_sync_queue')
    .select('id, action, status, attempts, contact_id, ghl_id, last_error, last_attempt_at, completed_at')
    .order('created_at', { ascending: true })
    .limit(5000)

  if (importId == null) q = q.is('import_id', null)
  else q = q.eq('import_id', importId)

  const { data: ops } = await q
  if (!ops?.length) return []

  // Hydrate contact display fields in one round-trip.
  const contactIds = [...new Set(ops.map((o) => o.contact_id).filter(Boolean) as string[])]
  const { data: contacts } = contactIds.length
    ? await sb.from('apulia_contacts').select('id, first_name, last_name, codice_amministratore, pod_pdr').in('id', contactIds)
    : { data: [] as Array<{ id: string; first_name: string | null; last_name: string | null; codice_amministratore: string | null; pod_pdr: string | null }> }
  const byId = new Map(((contacts ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null; codice_amministratore: string | null; pod_pdr: string | null }>).map((c) => [c.id, c]))

  return ops.map((o) => {
    const c = o.contact_id ? byId.get(o.contact_id as string) : null
    const name = c ? ([c.first_name, c.last_name].filter(Boolean).join(' ') || null) : null
    return {
      id: o.id as string,
      action: o.action as string,
      status: o.status as string,
      attempts: (o.attempts as number | null) ?? 0,
      contactId: (o.contact_id as string | null) ?? null,
      contactName: name,
      contactCode: c?.codice_amministratore ?? null,
      contactPod: c?.pod_pdr ?? null,
      ghlId: (o.ghl_id as string | null) ?? null,
      lastError: (o.last_error as string | null) ?? null,
      lastAttemptAt: (o.last_attempt_at as string | null) ?? null,
      completedAt: (o.completed_at as string | null) ?? null,
    }
  })
}

/** Reset all failed ops back to pending so the worker retries them. */
export async function retryFailedOps(): Promise<{ retried: number; error?: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { retried: 0, error: guard.error }
  const sb = createAdminClient()
  const { data } = await sb
    .from('apulia_sync_queue')
    .update({
      status: 'pending',
      attempts: 0,
      next_attempt_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('status', 'failed')
    .select('id')
  revalidatePath('/designs/apulia-power/settings')
  return { retried: data?.length ?? 0 }
}

/**
 * Trigger an immediate drain (manual button on the Sync queue tab).
 * Calls /api/apulia/sync/drain with the internal secret.
 */
export async function triggerDrainNow(): Promise<{ ok: boolean; error?: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { ok: false, error: guard.error }
  if (!process.env.CRON_SECRET) return { ok: false, error: 'CRON_SECRET non impostato' }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://core.bibotcrm.it'
  try {
    const r = await fetch(`${baseUrl}/api/apulia/sync/drain`, {
      method: 'POST',
      headers: { 'x-internal-secret': process.env.CRON_SECRET, 'Content-Type': 'application/json' },
    })
    if (!r.ok) return { ok: false, error: `Drain returned ${r.status}` }
    revalidatePath('/designs/apulia-power/settings')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'drain failed' }
  }
}

/**
 * Remove a tag from every Apulia contact. DB-first: strips the tag from
 * apulia_contacts.tags, marks rows pending_update, and enqueues one
 * remove_tag op per row for the worker.
 */
export async function deleteTagGlobally(tag: string): Promise<{ removed: number; failed: number; error?: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { removed: 0, failed: 0, error: guard.error }
  const t = tag.trim()
  if (!t) return { removed: 0, failed: 0, error: 'Tag vuoto' }

  const sb = createAdminClient()
  const { data: rows } = await sb
    .from('apulia_contacts')
    .select('id, ghl_id, tags')
    .contains('tags', [t])
    .neq('sync_status', 'pending_delete')
  if (!rows || rows.length === 0) return { removed: 0, failed: 0 }

  // Update tags array per row.
  for (const r of rows) {
    const remaining = ((r.tags as string[] | null) ?? []).filter((x) => x !== t)
    await sb.from('apulia_contacts').update({ tags: remaining, sync_status: 'pending_update' }).eq('id', r.id)
  }
  // Enqueue one remove_tag op per row.
  await enqueueOps(rows.map((r) => ({
    contact_id: r.id as string,
    ghl_id: (r.ghl_id as string | null) ?? null,
    action: 'remove_tag' as const,
    payload: { tag: t },
  })))

  revalidatePath('/designs/apulia-power/settings')
  revalidatePath('/designs/apulia-power/condomini')
  revalidatePath('/designs/apulia-power/amministratori')
  return { removed: rows.length, failed: 0 }
}
