'use server'

import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { ghlFetch } from '@/lib/apulia/ghl'
import { upsertContact, addTag as ghlAddTag, removeTag as ghlRemoveTag, deleteContact } from '@/lib/apulia/contacts'
import { deleteCached } from '@/lib/apulia/cache'
import { APULIA_FIELD } from '@/lib/apulia/fields'

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

/** Update one custom field on a condominio contact. Pushes to Bibot then patches the cache. */
export async function updateCondominoField(contactId: string, fieldId: string, value: string): Promise<{ error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard
  const r = await ghlFetch(`/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify({ customFields: [{ id: fieldId, value }] }),
  })
  if (!r.ok) return { error: `Bibot ${r.status}: ${(await r.text()).slice(0, 200)}` }

  // Update cache: re-fetch the contact for accurate downstream fields, but
  // a targeted JSON-merge keeps things snappy. We patch the JSON cf and any
  // shortcut columns that mirror it.
  const sb = createAdminClient()
  const { data: row } = await sb.from('apulia_contacts').select('custom_fields').eq('id', contactId).single()
  const cf = { ...((row?.custom_fields ?? {}) as Record<string, string>) }
  if (value) cf[fieldId] = value
  else delete cf[fieldId]
  const patch: Record<string, unknown> = { custom_fields: cf }
  if (fieldId === APULIA_FIELD.POD_PDR) patch.pod_pdr = value || null
  if (fieldId === APULIA_FIELD.CODICE_AMMINISTRATORE) patch.codice_amministratore = value || null
  if (fieldId === APULIA_FIELD.AMMINISTRATORE_CONDOMINIO) patch.amministratore_name = value || null
  if (fieldId === APULIA_FIELD.STATO) patch.stato = value || null
  if (fieldId === APULIA_FIELD.CLIENTE) patch.cliente = value || null
  if (fieldId === APULIA_FIELD.POD_OVERRIDE) patch.pod_override = value ? Number(String(value).replace(',', '.')) : null
  if (fieldId === APULIA_FIELD.COMPENSO_PER_POD) patch.compenso_per_pod = value ? Number(String(value).replace(',', '.')) : null
  if (fieldId === 'EXO9WD4aLV2aPiMYxXUU') patch.comune = value || null
  await sb.from('apulia_contacts').update(patch).eq('id', contactId)

  pathsToRevalidate(contactId)
}

/** Update core contact fields (firstName/lastName/email/phone). */
export async function updateCondominoCore(contactId: string, field: 'firstName' | 'lastName' | 'email' | 'phone', value: string): Promise<{ error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard
  try {
    await upsertContact({ id: contactId, [field]: value })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Aggiornamento fallito' }
  }
  const dbField = field === 'firstName' ? 'first_name' : field === 'lastName' ? 'last_name' : field
  const sb = createAdminClient()
  await sb.from('apulia_contacts').update({ [dbField]: value || null }).eq('id', contactId)
  pathsToRevalidate(contactId)
}

export async function addCondominoTag(contactId: string, tag: string): Promise<{ error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard
  if (!tag.trim()) return { error: 'Tag vuoto' }
  try {
    await ghlAddTag(contactId, tag.trim())
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Add tag fallito' }
  }
  // Refresh tags array in cache.
  const sb = createAdminClient()
  const { data: row } = await sb.from('apulia_contacts').select('tags').eq('id', contactId).single()
  const tags = Array.from(new Set([...(row?.tags ?? []), tag.trim()]))
  await sb.from('apulia_contacts').update({ tags }).eq('id', contactId)
  pathsToRevalidate(contactId)
}

export async function removeCondominoTag(contactId: string, tag: string): Promise<{ error?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard
  try {
    await ghlRemoveTag(contactId, tag)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Remove tag fallito' }
  }
  const sb = createAdminClient()
  const { data: row } = await sb.from('apulia_contacts').select('tags').eq('id', contactId).single()
  const tags = (row?.tags ?? []).filter((t: string) => t !== tag)
  await sb.from('apulia_contacts').update({ tags }).eq('id', contactId)
  pathsToRevalidate(contactId)
}

export async function deleteCondomino(contactId: string): Promise<{ error?: string; redirect?: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard
  try {
    await deleteContact(contactId)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Eliminazione fallita' }
  }
  await deleteCached(contactId)
  pathsToRevalidate(contactId)
  return { redirect: '/designs/apulia-power/condomini' }
}

