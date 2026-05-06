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
