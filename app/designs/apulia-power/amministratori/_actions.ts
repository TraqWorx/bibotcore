'use server'

import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { APULIA_FIELD, currentPeriod } from '@/lib/apulia/fields'
import { upsertContact, deleteContact } from '@/lib/apulia/contacts'
import { upsertCachedFromGhl, patchCached, fullSyncCache } from '@/lib/apulia/cache'
import { ghlFetch, pmap } from '@/lib/apulia/ghl'

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

/**
 * Bulk Paga — record a payment row for every selected admin in one shot.
 * Idempotent: re-marking already-paid admins is a no-op (unique on contact+period).
 */
export async function bulkMarkPaid(adminContactIds: string[], amounts: Record<string, number>): Promise<{ paid: number; skipped: number; error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return { paid: 0, skipped: 0, error: guard.error }
  const sb = createAdminClient()
  const period = currentPeriod()

  // Find admins already paid for this period — those are "skipped".
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
  firstPaymentAt?: string // ISO date
}

/**
 * Manually create one amministratore. Tagged `amministratore`, custom
 * fields populated from the form, anchor stamped to provided date or now.
 */
export async function createAdmin(input: CreateAdminInput): Promise<{ id?: string; error?: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { error: guard.error }
  const sb = createAdminClient()

  const name = (input.name ?? '').trim()
  const code = (input.codiceAmministratore ?? '').trim()
  if (!name) return { error: 'Nome richiesto' }
  if (!code) return { error: 'Codice amministratore richiesto' }

  // Reject duplicates by code.
  const { data: existing } = await sb
    .from('apulia_contacts')
    .select('id')
    .eq('is_amministratore', true)
    .eq('codice_amministratore', code)
    .maybeSingle()
  if (existing) return { error: `Amministratore con codice ${code} esiste già` }

  const cf: Record<string, string | number> = {
    [APULIA_FIELD.AMMINISTRATORE_CONDOMINIO]: name,
    [APULIA_FIELD.CODICE_AMMINISTRATORE]: code,
  }
  if (input.codiceFiscale) cf[APULIA_FIELD.CODICE_FISCALE_AMMINISTRATORE] = input.codiceFiscale
  if (input.partitaIva) cf[APULIA_FIELD.PARTITA_IVA_AMMINISTRATORE] = input.partitaIva
  if (input.phone) cf[APULIA_FIELD.TELEFONO_AMMINISTRATORE] = input.phone
  if (input.email) cf[APULIA_FIELD.EMAIL_BILLING] = input.email
  if (input.address) cf['oCvfwCelHDn6gWEljqUJ'] = input.address                 // Indirizzo
  if (input.city) cf['EXO9WD4aLV2aPiMYxXUU'] = input.city                       // Città
  if (input.province) cf['opaPQWrWwDiaAeyoMbN5'] = input.province               // Provincia
  if (input.compensoPerPod && input.compensoPerPod > 0) cf[APULIA_FIELD.COMPENSO_PER_POD] = input.compensoPerPod

  let newId: string
  try {
    newId = await upsertContact({
      email: input.email,
      phone: input.phone,
      firstName: name,
      tags: ['amministratore'],
      customField: cf,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Creazione fallita' }
  }
  if (!newId) return { error: 'ID contatto non restituito' }

  await upsertCachedFromGhl({
    id: newId,
    firstName: name,
    email: input.email,
    phone: input.phone,
    tags: ['amministratore'],
    customFields: Object.entries(cf).map(([id, value]) => ({ id, value: String(value) })),
  })

  const anchor = input.firstPaymentAt ? new Date(input.firstPaymentAt) : new Date()
  await sb.from('apulia_contacts').update({ first_payment_at: anchor.toISOString() }).eq('id', newId)

  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/dashboard')
  revalidatePath('/designs/apulia-power/settings')
  return { id: newId }
}

/**
 * Update the per-POD compenso for one amministratore. Pushes to Bibot custom
 * field, patches the cache, then recomputes commissione_totale (since POD
 * rows without a per-POD override fall back to this value).
 */
export async function setCompensoPerPod(adminContactId: string, amount: number): Promise<{ total?: number; error?: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { error: guard.error }
  if (!Number.isFinite(amount) || amount < 0) return { error: 'Importo non valido' }

  const sb = createAdminClient()
  const { data: admin } = await sb
    .from('apulia_contacts')
    .select('codice_amministratore')
    .eq('id', adminContactId)
    .eq('is_amministratore', true)
    .maybeSingle()
  if (!admin) return { error: 'Amministratore non trovato' }

  const r = await ghlFetch(`/contacts/${adminContactId}`, {
    method: 'PUT',
    body: JSON.stringify({ customFields: [{ id: APULIA_FIELD.COMPENSO_PER_POD, value: amount > 0 ? amount : '' }] }),
  })
  if (!r.ok) return { error: `Bibot ${r.status}: ${(await r.text()).slice(0, 200)}` }

  await patchCached(adminContactId, { compenso_per_pod: amount > 0 ? amount : null })

  // Recompute total from cache (override wins, else compenso).
  let newTotal = 0
  if (admin.codice_amministratore) {
    const { data: pods } = await sb
      .from('apulia_contacts')
      .select('pod_override')
      .eq('codice_amministratore', admin.codice_amministratore)
      .eq('is_amministratore', false)
      .eq('is_switch_out', false)
    newTotal = (pods ?? []).reduce((s, p) => s + (Number(p.pod_override) || amount), 0)
    const tr = await ghlFetch(`/contacts/${adminContactId}`, {
      method: 'PUT',
      body: JSON.stringify({ customFields: [{ id: APULIA_FIELD.COMMISSIONE_TOTALE, value: newTotal }] }),
    })
    if (tr.ok) await patchCached(adminContactId, { commissione_totale: newTotal })
  }

  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath(`/designs/apulia-power/amministratori/${adminContactId}`)
  revalidatePath('/designs/apulia-power/settings')
  revalidatePath('/designs/apulia-power/dashboard')
  return { total: newTotal }
}

/**
 * Bulk delete admins. POD linked to any of them are detached (their
 * codice_amministratore is cleared) so they remain in Bibot but unassigned.
 */
export async function bulkDeleteAdmins(ids: string[]): Promise<{ deleted: number; failed: number; error?: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { deleted: 0, failed: 0, error: guard.error }
  if (ids.length === 0) return { deleted: 0, failed: 0 }

  const sb = createAdminClient()
  const { data: rows } = await sb.from('apulia_contacts').select('id, codice_amministratore').in('id', ids).eq('is_amministratore', true)
  const codes = (rows ?? []).map((r) => r.codice_amministratore).filter((c): c is string => Boolean(c))

  let deleted = 0, failed = 0
  await pmap(rows ?? [], async (r) => {
    try {
      await deleteContact(r.id)
      await sb.from('apulia_contacts').delete().eq('id', r.id)
      deleted++
    } catch {
      failed++
    }
  }, 6)

  if (codes.length > 0) {
    await sb
      .from('apulia_contacts')
      .update({ codice_amministratore: null, amministratore_name: null })
      .in('codice_amministratore', codes)
      .eq('is_amministratore', false)
  }

  // Reconcile against GHL — bulk semantics can miss webhooks.
  try { await fullSyncCache() } catch { /* ignore */ }

  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/condomini')
  revalidatePath('/designs/apulia-power/dashboard')
  revalidatePath('/designs/apulia-power/settings')
  return { deleted, failed }
}
