'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { APULIA_FIELD } from '@/lib/apulia/fields'
import { APULIA_IMPERSONATE_COOKIE } from '@/lib/apulia/auth'
import { enqueueOp } from '@/lib/apulia/sync-queue'

async function ensureOwner(): Promise<{ email: string } | { error: string }> {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) return { error: 'Forbidden' }
  if (profile.role !== 'admin' && profile.role !== 'super_admin') return { error: 'Forbidden' }
  return { email: user.email ?? '' }
}

/**
 * Recompute and persist commissione_totale for one admin. Called from any
 * action that changes a POD override / compenso / switch-out state.
 * Returns the new total. Also enqueues a set_field op for GHL.
 */
async function recomputeAdmin(adminContactId: string): Promise<number> {
  const sb = createAdminClient()
  const { data: admin } = await sb
    .from('apulia_contacts')
    .select('id, ghl_id, codice_amministratore, compenso_per_pod, commissione_totale, custom_fields')
    .eq('id', adminContactId)
    .maybeSingle()
  if (!admin?.codice_amministratore) return 0

  const { data: pods } = await sb
    .from('apulia_contacts')
    .select('pod_override')
    .eq('codice_amministratore', admin.codice_amministratore)
    .eq('is_amministratore', false)
    .eq('is_switch_out', false)
    .neq('sync_status', 'pending_delete')

  const compenso = Number(admin.compenso_per_pod) || 0
  const newTotal = (pods ?? []).reduce((s, p) => s + (Number(p.pod_override) || compenso), 0)

  const current = Number(admin.commissione_totale) || 0
  if (Math.round(current * 100) === Math.round(newTotal * 100)) return newTotal

  const cf = { ...((admin.custom_fields ?? {}) as Record<string, string>), [APULIA_FIELD.COMMISSIONE_TOTALE]: String(newTotal) }
  await sb.from('apulia_contacts').update({
    commissione_totale: newTotal,
    custom_fields: cf,
    sync_status: 'pending_update',
  }).eq('id', admin.id)

  await enqueueOp({
    contact_id: admin.id,
    ghl_id: admin.ghl_id ?? null,
    action: 'set_field',
    payload: { fieldId: APULIA_FIELD.COMMISSIONE_TOTALE, value: newTotal },
  })

  return newTotal
}

export async function setPodOverride(podContactId: string, amount: number, adminContactId: string): Promise<{ error: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  const sb = createAdminClient()
  const { data: pod } = await sb.from('apulia_contacts').select('ghl_id, custom_fields').eq('id', podContactId).maybeSingle()
  if (!pod) return { error: 'POD non trovato' }

  const newValue = amount > 0 ? amount : null
  const cf = { ...((pod.custom_fields ?? {}) as Record<string, string>) }
  if (newValue != null) cf[APULIA_FIELD.POD_OVERRIDE] = String(newValue)
  else delete cf[APULIA_FIELD.POD_OVERRIDE]

  await sb.from('apulia_contacts').update({
    pod_override: newValue,
    custom_fields: cf,
    sync_status: 'pending_update',
  }).eq('id', podContactId)

  await enqueueOp({
    contact_id: podContactId,
    ghl_id: pod.ghl_id ?? null,
    action: 'set_field',
    payload: { fieldId: APULIA_FIELD.POD_OVERRIDE, value: newValue ?? '' },
  })

  await recomputeAdmin(adminContactId)

  revalidatePath(`/designs/apulia-power/amministratori/${adminContactId}`)
  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/dashboard')
}

export async function markPaid(adminContactId: string, amountCents: number, note?: string): Promise<{ error: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  const sb = createAdminClient()
  const { data: schedule } = await sb.rpc('apulia_admin_schedule')
  type ScheduleRow = { contact_id: string; first_payment_at: string | null; paid_count: number; next_period_idx: number; next_due_date: string | null; is_due_now: boolean; overdue_count: number }
  const sched = ((schedule ?? []) as ScheduleRow[]).find((s) => s.contact_id === adminContactId)
  if (!sched) return { error: 'Schedule non trovato' }
  if (!sched.first_payment_at) return { error: "Imposta prima la data del 1° pagamento dell'amministratore" }

  const { error } = await sb.from('apulia_payments').insert({
    contact_id: adminContactId,
    period: `idx-${sched.next_period_idx}`,
    period_idx: sched.next_period_idx,
    period_due_date: sched.next_due_date,
    amount_cents: amountCents,
    paid_at: new Date().toISOString(),
    paid_by: guard.email,
    note: note ?? null,
  })
  if (error) return { error: error.message }

  revalidatePath(`/designs/apulia-power/amministratori/${adminContactId}`)
  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/pagamenti')
  revalidatePath('/designs/apulia-power/dashboard')
}

export async function unmarkPaid(adminContactId: string): Promise<{ error: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  const sb = createAdminClient()
  const { data: latest } = await sb
    .from('apulia_payments')
    .select('id')
    .eq('contact_id', adminContactId)
    .not('period_idx', 'is', null)
    .order('period_idx', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!latest) return { error: 'Nessun pagamento da annullare' }
  const { error } = await sb.from('apulia_payments').delete().eq('id', latest.id)
  if (error) return { error: error.message }

  revalidatePath(`/designs/apulia-power/amministratori/${adminContactId}`)
  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/pagamenti')
  revalidatePath('/designs/apulia-power/dashboard')
}

export async function setFirstPaymentDate(adminContactId: string, isoDate: string): Promise<{ error: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return { error: 'Data non valida' }
  const sb = createAdminClient()
  const { error } = await sb.from('apulia_contacts').update({ first_payment_at: d.toISOString() }).eq('id', adminContactId)
  if (error) return { error: error.message }
  revalidatePath(`/designs/apulia-power/amministratori/${adminContactId}`)
  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/dashboard')
  revalidatePath('/designs/apulia-power/settings')
}

export async function startImpersonation(adminContactId: string): Promise<{ error: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  const sb = createAdminClient()
  const { data: target } = await sb
    .from('apulia_contacts')
    .select('id')
    .eq('id', adminContactId)
    .eq('is_amministratore', true)
    .neq('sync_status', 'pending_delete')
    .maybeSingle()
  if (!target) return { error: 'Amministratore non trovato' }

  const cookieStore = await cookies()
  cookieStore.set(APULIA_IMPERSONATE_COOKIE, adminContactId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60,
  })
}

export async function exitImpersonation(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(APULIA_IMPERSONATE_COOKIE)
}

function pathsToRevalidateAdmin(id: string) {
  revalidatePath(`/designs/apulia-power/amministratori/${id}`)
  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/dashboard')
  revalidatePath('/designs/apulia-power/settings')
}

export async function updateAdminField(contactId: string, fieldId: string, value: string): Promise<{ error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  const sb = createAdminClient()
  const { data: row } = await sb.from('apulia_contacts').select('ghl_id, custom_fields').eq('id', contactId).maybeSingle()
  if (!row) return { error: 'Contatto non trovato' }

  const cf = { ...((row.custom_fields ?? {}) as Record<string, string>) }
  if (value) cf[fieldId] = value
  else delete cf[fieldId]

  const patch: Record<string, unknown> = { custom_fields: cf, sync_status: 'pending_update' }
  if (fieldId === APULIA_FIELD.CODICE_AMMINISTRATORE) patch.codice_amministratore = value || null
  if (fieldId === APULIA_FIELD.AMMINISTRATORE_CONDOMINIO) patch.amministratore_name = value || null
  if (fieldId === APULIA_FIELD.COMPENSO_PER_POD) patch.compenso_per_pod = value ? Number(String(value).replace(',', '.')) : null

  const { error } = await sb.from('apulia_contacts').update(patch).eq('id', contactId)
  if (error) return { error: error.message }

  await enqueueOp({
    contact_id: contactId,
    ghl_id: row.ghl_id ?? null,
    action: 'set_field',
    payload: { fieldId, value },
  })

  // If compenso changed, recompute the admin's commissione_totale.
  if (fieldId === APULIA_FIELD.COMPENSO_PER_POD) {
    await recomputeAdmin(contactId)
  }

  pathsToRevalidateAdmin(contactId)
}

export async function updateAdminCore(contactId: string, field: 'firstName' | 'lastName' | 'email' | 'phone', value: string): Promise<{ error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  const sb = createAdminClient()
  const { data: row } = await sb.from('apulia_contacts').select('ghl_id').eq('id', contactId).maybeSingle()
  if (!row) return { error: 'Contatto non trovato' }

  const dbField = field === 'firstName' ? 'first_name' : field === 'lastName' ? 'last_name' : field
  const { error } = await sb.from('apulia_contacts').update({
    [dbField]: value || null,
    sync_status: 'pending_update',
  }).eq('id', contactId)
  if (error) return { error: error.message }

  await enqueueOp({ contact_id: contactId, ghl_id: row.ghl_id ?? null, action: 'update' })
  pathsToRevalidateAdmin(contactId)
}

export async function addAdminTag(contactId: string, tag: string): Promise<{ error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard
  const t = tag.trim()
  if (!t) return { error: 'Tag vuoto' }

  const sb = createAdminClient()
  const { data: row } = await sb.from('apulia_contacts').select('ghl_id, tags').eq('id', contactId).maybeSingle()
  if (!row) return { error: 'Contatto non trovato' }
  const tags = Array.from(new Set([...((row.tags as string[] | null) ?? []), t]))
  await sb.from('apulia_contacts').update({ tags, sync_status: 'pending_update' }).eq('id', contactId)
  await enqueueOp({ contact_id: contactId, ghl_id: row.ghl_id ?? null, action: 'add_tag', payload: { tag: t } })
  pathsToRevalidateAdmin(contactId)
}

export async function removeAdminTag(contactId: string, tag: string): Promise<{ error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  const sb = createAdminClient()
  const { data: row } = await sb.from('apulia_contacts').select('ghl_id, tags').eq('id', contactId).maybeSingle()
  if (!row) return { error: 'Contatto non trovato' }
  const tags = ((row.tags as string[] | null) ?? []).filter((x) => x !== tag)
  await sb.from('apulia_contacts').update({ tags, sync_status: 'pending_update' }).eq('id', contactId)
  await enqueueOp({ contact_id: contactId, ghl_id: row.ghl_id ?? null, action: 'remove_tag', payload: { tag } })
  pathsToRevalidateAdmin(contactId)
}

/**
 * Soft-delete an admin. Linked POD condomini stay; their codice_amministratore
 * is cleared so they appear orphaned. Worker hard-deletes the admin row from
 * apulia_contacts after GHL ack.
 */
export async function deleteAdmin(contactId: string, force?: boolean): Promise<{ error?: string; warn?: string; redirect?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard
  const sb = createAdminClient()

  const { data: admin } = await sb.from('apulia_contacts').select('ghl_id, codice_amministratore').eq('id', contactId).maybeSingle()
  if (!admin) return { error: 'Amministratore non trovato' }

  if (admin.codice_amministratore && !force) {
    const { count } = await sb
      .from('apulia_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('codice_amministratore', admin.codice_amministratore)
      .eq('is_amministratore', false)
      .neq('sync_status', 'pending_delete')
    if (count && count > 0) {
      return { warn: `Ci sono ${count} POD collegati a questo amministratore. Eliminandolo verranno lasciati orfani (POD intatti, ma senza amministratore associato). Procedere?` }
    }
  }

  if (!admin.ghl_id) {
    // Never made it to GHL — hard-delete + clean queue.
    await sb.from('apulia_sync_queue').delete().eq('contact_id', contactId).eq('status', 'pending')
    await sb.from('apulia_contacts').delete().eq('id', contactId)
  } else {
    await sb.from('apulia_contacts').update({ sync_status: 'pending_delete' }).eq('id', contactId)
    await enqueueOp({ contact_id: contactId, ghl_id: admin.ghl_id, action: 'delete' })
  }

  if (admin.codice_amministratore && force) {
    // Detach orphaned PODs locally and enqueue a set_field for each so GHL
    // also clears Codice amministratore on the POD contacts.
    const { data: orphans } = await sb
      .from('apulia_contacts')
      .select('id, ghl_id')
      .eq('codice_amministratore', admin.codice_amministratore)
      .eq('is_amministratore', false)
      .neq('sync_status', 'pending_delete')
    if (orphans?.length) {
      await sb
        .from('apulia_contacts')
        .update({ codice_amministratore: null, amministratore_name: null, sync_status: 'pending_update' })
        .in('id', orphans.map((r) => r.id))
      // Two set_field ops per orphan. One enqueue call batches them.
      const ops = orphans.flatMap((r) => [
        { contact_id: r.id, ghl_id: r.ghl_id ?? null, action: 'set_field' as const, payload: { fieldId: APULIA_FIELD.CODICE_AMMINISTRATORE, value: '' } },
        { contact_id: r.id, ghl_id: r.ghl_id ?? null, action: 'set_field' as const, payload: { fieldId: APULIA_FIELD.AMMINISTRATORE_CONDOMINIO, value: '' } },
      ])
      const { enqueueOps } = await import('@/lib/apulia/sync-queue')
      await enqueueOps(ops)
    }
  }

  pathsToRevalidateAdmin(contactId)
  return { redirect: '/designs/apulia-power/amministratori' }
}
