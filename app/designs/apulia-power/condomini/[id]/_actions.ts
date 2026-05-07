'use server'

import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { APULIA_FIELD, APULIA_TAG } from '@/lib/apulia/fields'
import { enqueueOp } from '@/lib/apulia/sync-queue'

/**
 * Recompute commissione_totale for one admin and enqueue the GHL push.
 * Called whenever a POD's switch-out flag flips (active count changes).
 */
async function recomputeAdminTotal(adminContactId: string): Promise<void> {
  const sb = createAdminClient()
  const { data: admin } = await sb.from('apulia_contacts').select('id, ghl_id, codice_amministratore, compenso_per_pod, commissione_totale, custom_fields').eq('id', adminContactId).maybeSingle()
  if (!admin?.codice_amministratore) return
  const compenso = Number(admin.compenso_per_pod) || 0
  let total = 0
  for (let from = 0; ; from += 1000) {
    const { data: pods } = await sb.from('apulia_contacts').select('pod_override').eq('codice_amministratore', admin.codice_amministratore).eq('is_amministratore', false).eq('is_switch_out', false).neq('sync_status', 'pending_delete').range(from, from + 999)
    if (!pods || pods.length === 0) break
    for (const p of pods) {
      const ovr = Number(p.pod_override) || 0
      total += ovr > 0 ? ovr : compenso
    }
    if (pods.length < 1000) break
  }
  const stored = Number(admin.commissione_totale) || 0
  if (Math.round(stored * 100) === Math.round(total * 100)) return
  const cf = { ...((admin.custom_fields ?? {}) as Record<string, string>), [APULIA_FIELD.COMMISSIONE_TOTALE]: String(total) }
  await sb.from('apulia_contacts').update({ commissione_totale: total, custom_fields: cf, sync_status: 'pending_update' }).eq('id', admin.id)
  await enqueueOp({ contact_id: admin.id, ghl_id: admin.ghl_id ?? null, action: 'set_field', payload: { fieldId: APULIA_FIELD.COMMISSIONE_TOTALE, value: total } })
}

/** Find the admin row a POD belongs to (by codice_amministratore). */
async function adminForCondomino(contactId: string): Promise<string | null> {
  const sb = createAdminClient()
  const { data: row } = await sb.from('apulia_contacts').select('codice_amministratore').eq('id', contactId).maybeSingle()
  if (!row?.codice_amministratore) return null
  const { data: admin } = await sb.from('apulia_contacts').select('id').eq('is_amministratore', true).eq('codice_amministratore', row.codice_amministratore).neq('sync_status', 'pending_delete').maybeSingle()
  return admin?.id ?? null
}

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

function pathsToRevalidate(id: string) {
  revalidatePath(`/designs/apulia-power/condomini/${id}`)
  revalidatePath('/designs/apulia-power/condomini')
  revalidatePath('/designs/apulia-power/dashboard')
}

/**
 * If the row never made it to GHL (ghl_id null — pending_create or
 * previously failed), re-queue a fresh 'create' op so the worker tries
 * to push the latest local snapshot. Otherwise queue the requested
 * action as usual.
 */
async function enqueueOrRetryCreate(
  contactId: string,
  ghlId: string | null,
  action: 'update' | 'set_field' | 'add_tag' | 'remove_tag',
  payload?: unknown,
): Promise<void> {
  const sb = createAdminClient()
  if (!ghlId) {
    await sb.from('apulia_sync_queue').delete().eq('contact_id', contactId).eq('status', 'pending')
    await sb.from('apulia_contacts').update({ sync_status: 'pending_create', sync_error: null }).eq('id', contactId)
    await enqueueOp({ contact_id: contactId, ghl_id: null, action: 'create' })
    return
  }
  await enqueueOp({ contact_id: contactId, ghl_id: ghlId, action, payload })
}

/** Bibot is now source of truth — UPDATE the row, enqueue the GHL push. */
export async function updateCondominoField(contactId: string, fieldId: string, value: string): Promise<{ error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  const sb = createAdminClient()
  const { data: row } = await sb.from('apulia_contacts').select('ghl_id, custom_fields').eq('id', contactId).maybeSingle()
  if (!row) return { error: 'Contatto non trovato' }

  const cf = { ...((row.custom_fields ?? {}) as Record<string, string>) }
  if (value) cf[fieldId] = value
  else delete cf[fieldId]

  const patch: Record<string, unknown> = { custom_fields: cf, sync_status: 'pending_update' }
  if (fieldId === APULIA_FIELD.POD_PDR) patch.pod_pdr = value || null
  if (fieldId === APULIA_FIELD.CODICE_AMMINISTRATORE) patch.codice_amministratore = value || null
  if (fieldId === APULIA_FIELD.AMMINISTRATORE_CONDOMINIO) patch.amministratore_name = value || null
  if (fieldId === APULIA_FIELD.STATO) patch.stato = value || null
  if (fieldId === APULIA_FIELD.CLIENTE) patch.cliente = value || null
  if (fieldId === APULIA_FIELD.POD_OVERRIDE) patch.pod_override = value ? Number(String(value).replace(',', '.')) : null
  if (fieldId === APULIA_FIELD.COMPENSO_PER_POD) patch.compenso_per_pod = value ? Number(String(value).replace(',', '.')) : null
  if (fieldId === 'EXO9WD4aLV2aPiMYxXUU') patch.comune = value || null

  const { error } = await sb.from('apulia_contacts').update(patch).eq('id', contactId)
  if (error) return { error: error.message }

  await enqueueOrRetryCreate(contactId, row.ghl_id ?? null, 'set_field', { fieldId, value })

  pathsToRevalidate(contactId)
}

export async function updateCondominoCore(contactId: string, field: 'firstName' | 'lastName' | 'email' | 'phone', value: string): Promise<{ error?: string } | undefined> {
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

  await enqueueOrRetryCreate(contactId, row.ghl_id ?? null, 'update')
  pathsToRevalidate(contactId)
}

export async function addCondominoTag(contactId: string, tag: string): Promise<{ error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard
  const t = tag.trim()
  if (!t) return { error: 'Tag vuoto' }

  const sb = createAdminClient()
  const { data: row } = await sb.from('apulia_contacts').select('ghl_id, tags, is_switch_out').eq('id', contactId).maybeSingle()
  if (!row) return { error: 'Contatto non trovato' }
  const tags = Array.from(new Set([...((row.tags as string[] | null) ?? []), t]))
  // Tag→flag mirroring: if the user added "switch-out" (any case) the
  // boolean must follow so the POD drops out of the commission sum.
  const isSwitchOutTag = t.toLowerCase() === APULIA_TAG.SWITCH_OUT.toLowerCase()
  const patch: Record<string, unknown> = { tags, sync_status: 'pending_update' }
  if (isSwitchOutTag && !row.is_switch_out) patch.is_switch_out = true
  await sb.from('apulia_contacts').update(patch).eq('id', contactId)
  await enqueueOrRetryCreate(contactId, row.ghl_id ?? null, 'add_tag', { tag: t })
  if (isSwitchOutTag) {
    const adminId = await adminForCondomino(contactId)
    if (adminId) await recomputeAdminTotal(adminId)
  }
  pathsToRevalidate(contactId)
}

export async function removeCondominoTag(contactId: string, tag: string): Promise<{ error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  const sb = createAdminClient()
  const { data: row } = await sb.from('apulia_contacts').select('ghl_id, tags, is_switch_out').eq('id', contactId).maybeSingle()
  if (!row) return { error: 'Contatto non trovato' }
  const tags = ((row.tags as string[] | null) ?? []).filter((x) => x !== tag)
  // Tag→flag mirroring: removing "switch-out" should put the POD back
  // into the commission calculation. Flip the flag and recompute.
  const isSwitchOutTag = tag.toLowerCase() === APULIA_TAG.SWITCH_OUT.toLowerCase()
  const patch: Record<string, unknown> = { tags, sync_status: 'pending_update' }
  if (isSwitchOutTag && row.is_switch_out) patch.is_switch_out = false
  await sb.from('apulia_contacts').update(patch).eq('id', contactId)
  await enqueueOrRetryCreate(contactId, row.ghl_id ?? null, 'remove_tag', { tag })
  if (isSwitchOutTag) {
    const adminId = await adminForCondomino(contactId)
    if (adminId) await recomputeAdminTotal(adminId)
  }
  pathsToRevalidate(contactId)
}

export async function setCondominoAdminByCode(contactId: string, code: string): Promise<{ error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard
  const sb = createAdminClient()
  const trimmed = (code ?? '').trim()
  let name = ''
  if (trimmed) {
    const { data: admin } = await sb
      .from('apulia_contacts')
      .select('first_name, last_name')
      .eq('is_amministratore', true)
      .eq('codice_amministratore', trimmed)
      .neq('sync_status', 'pending_delete')
      .maybeSingle()
    if (!admin) return { error: `Nessun amministratore con codice ${trimmed}` }
    name = [admin.first_name, admin.last_name].filter(Boolean).join(' ')
  }

  const { data: row } = await sb.from('apulia_contacts').select('ghl_id, custom_fields').eq('id', contactId).maybeSingle()
  if (!row) return { error: 'Contatto non trovato' }

  const cf = { ...((row.custom_fields ?? {}) as Record<string, string>) }
  if (trimmed) cf[APULIA_FIELD.CODICE_AMMINISTRATORE] = trimmed
  else delete cf[APULIA_FIELD.CODICE_AMMINISTRATORE]
  if (name) cf[APULIA_FIELD.AMMINISTRATORE_CONDOMINIO] = name
  else delete cf[APULIA_FIELD.AMMINISTRATORE_CONDOMINIO]

  await sb.from('apulia_contacts').update({
    custom_fields: cf,
    codice_amministratore: trimmed || null,
    amministratore_name: name || null,
    sync_status: 'pending_update',
  }).eq('id', contactId)

  await enqueueOrRetryCreate(contactId, row.ghl_id ?? null, 'update')
  pathsToRevalidate(contactId)
}

/**
 * Soft-delete: flip sync_status to pending_delete and enqueue. The worker
 * hard-deletes the row from apulia_contacts after GHL acknowledges.
 * UI reads filter pending_delete out so the row disappears immediately.
 */
export async function deleteCondomino(contactId: string): Promise<{ error?: string; redirect?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  const sb = createAdminClient()
  const { data: row } = await sb.from('apulia_contacts').select('ghl_id').eq('id', contactId).maybeSingle()
  if (!row) return { error: 'Contatto non trovato' }

  if (!row.ghl_id) {
    // Never made it to GHL — just hard-delete locally and clean any
    // pending queue ops. Saves a useless GHL DELETE.
    await sb.from('apulia_sync_queue').delete().eq('contact_id', contactId).eq('status', 'pending')
    await sb.from('apulia_contacts').delete().eq('id', contactId)
  } else {
    await sb.from('apulia_contacts').update({ sync_status: 'pending_delete' }).eq('id', contactId)
    await enqueueOp({ contact_id: contactId, ghl_id: row.ghl_id, action: 'delete' })
  }

  pathsToRevalidate(contactId)
  return { redirect: '/designs/apulia-power/condomini' }
}
