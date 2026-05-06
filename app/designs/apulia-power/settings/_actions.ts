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
