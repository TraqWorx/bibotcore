'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { APULIA_FIELD, APULIA_TAG, currentPeriod } from '@/lib/apulia/fields'
import { enqueueOp, enqueueOps } from '@/lib/apulia/sync-queue'

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

export async function bulkMarkPaid(adminContactIds: string[], amounts: Record<string, number>): Promise<{ paid: number; skipped: number; error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return { paid: 0, skipped: 0, error: guard.error }
  const sb = createAdminClient()
  const period = currentPeriod()

  const { data: existing } = await sb.from('apulia_payments')
    .select('contact_id')
    .eq('period', period)
    .in('contact_id', adminContactIds)
  const alreadyPaid = new Set((existing ?? []).map((r) => r.contact_id))
  const toInsert = adminContactIds
    .filter((id) => !alreadyPaid.has(id))
    .map((id) => ({
      contact_id: id,
      period,
      amount_cents: Math.round((amounts[id] ?? 0) * 100),
      paid_at: new Date().toISOString(),
      paid_by: guard.email,
    }))
    .filter((r) => r.amount_cents > 0)

  if (toInsert.length) {
    const { error } = await sb.from('apulia_payments').insert(toInsert)
    if (error) return { paid: 0, skipped: alreadyPaid.size, error: error.message }
  }

  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/dashboard')
  revalidatePath('/designs/apulia-power/pagamenti')
  return { paid: toInsert.length, skipped: alreadyPaid.size }
}

export interface CreateAdminInput {
  name: string
  codiceAmministratore: string
  email?: string
  phone?: string
  codiceFiscale?: string
  partitaIva?: string
  address?: string
  city?: string
  province?: string
  compensoPerPod?: number
  firstPaymentAt?: string
}

/**
 * Manually create one amministratore — DB-first. INSERTs a fresh uuid row
 * with sync_status='pending_create' and ghl_id=null; the worker pushes
 * to GHL and stamps ghl_id back.
 */
export async function createAdmin(input: CreateAdminInput): Promise<{ id?: string; error?: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { error: guard.error }
  const sb = createAdminClient()

  const name = (input.name ?? '').trim()
  const code = (input.codiceAmministratore ?? '').trim()
  if (!name) return { error: 'Nome richiesto' }
  if (!code) return { error: 'Codice amministratore richiesto' }

  const { data: existing } = await sb
    .from('apulia_contacts')
    .select('id')
    .eq('is_amministratore', true)
    .eq('codice_amministratore', code)
    .neq('sync_status', 'pending_delete')
    .maybeSingle()
  if (existing) return { error: `Amministratore con codice ${code} esiste già` }

  const cf: Record<string, string> = {
    [APULIA_FIELD.AMMINISTRATORE_CONDOMINIO]: name,
    [APULIA_FIELD.CODICE_AMMINISTRATORE]: code,
  }
  if (input.codiceFiscale) cf[APULIA_FIELD.CODICE_FISCALE_AMMINISTRATORE] = input.codiceFiscale
  if (input.partitaIva) cf[APULIA_FIELD.PARTITA_IVA_AMMINISTRATORE] = input.partitaIva
  if (input.phone) cf[APULIA_FIELD.TELEFONO_AMMINISTRATORE] = input.phone
  if (input.email) cf[APULIA_FIELD.EMAIL_BILLING] = input.email
  if (input.address) cf['oCvfwCelHDn6gWEljqUJ'] = input.address
  if (input.city) cf['EXO9WD4aLV2aPiMYxXUU'] = input.city
  if (input.province) cf['opaPQWrWwDiaAeyoMbN5'] = input.province
  if (input.compensoPerPod && input.compensoPerPod > 0) {
    cf[APULIA_FIELD.COMPENSO_PER_POD] = String(input.compensoPerPod)
  }

  const id = randomUUID()
  const anchor = input.firstPaymentAt ? new Date(input.firstPaymentAt) : new Date()

  const { error } = await sb.from('apulia_contacts').insert({
    id,
    ghl_id: null,
    sync_status: 'pending_create',
    email: input.email ?? null,
    phone: input.phone ?? null,
    first_name: name,
    last_name: null,
    tags: [APULIA_TAG.AMMINISTRATORE],
    custom_fields: cf,
    pod_pdr: null,
    codice_amministratore: code,
    amministratore_name: name,
    cliente: null,
    comune: input.city ?? null,
    stato: null,
    compenso_per_pod: input.compensoPerPod && input.compensoPerPod > 0 ? input.compensoPerPod : null,
    pod_override: null,
    commissione_totale: null,
    is_amministratore: true,
    is_switch_out: false,
    ghl_updated_at: null,
    first_payment_at: anchor.toISOString(),
  })
  if (error) return { error: error.message }

  await enqueueOp({ contact_id: id, ghl_id: null, action: 'create' })

  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/dashboard')
  revalidatePath('/designs/apulia-power/settings')
  return { id }
}

/**
 * Update compenso_per_pod for one admin. Recomputes commissione_totale
 * (DB-only) and enqueues a set_field op for the new compenso plus a
 * set_field op for the new total.
 */
export async function setCompensoPerPod(adminContactId: string, amount: number): Promise<{ total?: number; error?: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { error: guard.error }
  if (!Number.isFinite(amount) || amount < 0) return { error: 'Importo non valido' }

  const sb = createAdminClient()
  const { data: admin } = await sb
    .from('apulia_contacts')
    .select('ghl_id, codice_amministratore, custom_fields')
    .eq('id', adminContactId)
    .eq('is_amministratore', true)
    .neq('sync_status', 'pending_delete')
    .maybeSingle()
  if (!admin) return { error: 'Amministratore non trovato' }

  const newCompenso = amount > 0 ? amount : null
  const cf = { ...((admin.custom_fields ?? {}) as Record<string, string>) }
  if (newCompenso != null) cf[APULIA_FIELD.COMPENSO_PER_POD] = String(newCompenso)
  else delete cf[APULIA_FIELD.COMPENSO_PER_POD]

  // Compute new total before persisting so cf carries it too.
  let newTotal = 0
  if (admin.codice_amministratore) {
    const { data: pods } = await sb
      .from('apulia_contacts')
      .select('pod_override')
      .eq('codice_amministratore', admin.codice_amministratore)
      .eq('is_amministratore', false)
      .eq('is_switch_out', false)
      .neq('sync_status', 'pending_delete')
    newTotal = (pods ?? []).reduce((s, p) => s + (Number(p.pod_override) || (newCompenso ?? 0)), 0)
    cf[APULIA_FIELD.COMMISSIONE_TOTALE] = String(newTotal)
  }

  await sb.from('apulia_contacts').update({
    compenso_per_pod: newCompenso,
    commissione_totale: newTotal || null,
    custom_fields: cf,
    sync_status: 'pending_update',
  }).eq('id', adminContactId)

  await enqueueOps([
    {
      contact_id: adminContactId,
      ghl_id: admin.ghl_id ?? null,
      action: 'set_field',
      payload: { fieldId: APULIA_FIELD.COMPENSO_PER_POD, value: newCompenso ?? '' },
    },
    {
      contact_id: adminContactId,
      ghl_id: admin.ghl_id ?? null,
      action: 'set_field',
      payload: { fieldId: APULIA_FIELD.COMMISSIONE_TOTALE, value: newTotal },
    },
  ])

  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath(`/designs/apulia-power/amministratori/${adminContactId}`)
  revalidatePath('/designs/apulia-power/settings')
  revalidatePath('/designs/apulia-power/dashboard')
  return { total: newTotal }
}

/**
 * Soft-delete admins in bulk. Linked POD condomini have their
 * codice_amministratore cleared so they remain in Bibot but unassigned.
 */
export async function bulkDeleteAdmins(ids: string[]): Promise<{ deleted: number; failed: number; error?: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { deleted: 0, failed: 0, error: guard.error }
  if (ids.length === 0) return { deleted: 0, failed: 0 }

  const sb = createAdminClient()
  const { data: rows } = await sb
    .from('apulia_contacts')
    .select('id, ghl_id, codice_amministratore')
    .in('id', ids)
    .eq('is_amministratore', true)
  if (!rows?.length) return { deleted: 0, failed: 0 }
  const codes = rows.map((r) => r.codice_amministratore).filter((c): c is string => Boolean(c))

  // Hard-delete ones that never made it to GHL (ghl_id is null) — saves a
  // pointless GHL DELETE later.
  const localOnly = rows.filter((r) => !r.ghl_id).map((r) => r.id)
  const remote = rows.filter((r) => r.ghl_id) as Array<{ id: string; ghl_id: string }>

  // Chunk all .in() ops by 500 ids — URL length + 1000-row caps.
  const CHUNK = 500
  if (localOnly.length) {
    for (let i = 0; i < localOnly.length; i += CHUNK) {
      const slice = localOnly.slice(i, i + CHUNK)
      await sb.from('apulia_sync_queue').delete().in('contact_id', slice).eq('status', 'pending')
      await sb.from('apulia_contacts').delete().in('id', slice)
    }
  }
  if (remote.length) {
    const remoteIds = remote.map((r) => r.id)
    for (let i = 0; i < remoteIds.length; i += CHUNK) {
      await sb.from('apulia_contacts').update({ sync_status: 'pending_delete' }).in('id', remoteIds.slice(i, i + CHUNK))
    }
    await enqueueOps(remote.map((r) => ({ contact_id: r.id, ghl_id: r.ghl_id, action: 'delete' as const })))
  }

  // Detach POD condomini from the deleted admins. Paginate the
  // discovery query AND chunk the subsequent updates.
  if (codes.length > 0) {
    const orphans: Array<{ id: string; ghl_id: string | null }> = []
    for (let from = 0; ; from += 1000) {
      const { data } = await sb
        .from('apulia_contacts')
        .select('id, ghl_id')
        .in('codice_amministratore', codes)
        .eq('is_amministratore', false)
        .neq('sync_status', 'pending_delete')
        .range(from, from + 999)
      if (!data || data.length === 0) break
      orphans.push(...(data as Array<{ id: string; ghl_id: string | null }>))
      if (data.length < 1000) break
    }
    if (orphans.length) {
      const orphanIds = orphans.map((r) => r.id)
      for (let i = 0; i < orphanIds.length; i += CHUNK) {
        await sb.from('apulia_contacts')
          .update({ codice_amministratore: null, amministratore_name: null, sync_status: 'pending_update' })
          .in('id', orphanIds.slice(i, i + CHUNK))
      }
      const ops = orphans.flatMap((r) => [
        { contact_id: r.id, ghl_id: r.ghl_id ?? null, action: 'set_field' as const, payload: { fieldId: APULIA_FIELD.CODICE_AMMINISTRATORE, value: '' } },
        { contact_id: r.id, ghl_id: r.ghl_id ?? null, action: 'set_field' as const, payload: { fieldId: APULIA_FIELD.AMMINISTRATORE_CONDOMINIO, value: '' } },
      ])
      await enqueueOps(ops)
    }
  }

  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/condomini')
  revalidatePath('/designs/apulia-power/dashboard')
  revalidatePath('/designs/apulia-power/settings')
  return { deleted: rows.length, failed: 0 }
}
