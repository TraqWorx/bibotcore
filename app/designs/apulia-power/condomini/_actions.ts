'use server'

import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { upsertContact, deleteContact } from '@/lib/apulia/contacts'
import { upsertCachedFromGhl } from '@/lib/apulia/cache'
import { pmap } from '@/lib/apulia/ghl'
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

export interface CreateCondominoInput {
  podPdr: string
  cliente: string
  codiceAmministratore?: string
  email?: string
  phone?: string
  comune?: string
  indirizzo?: string
  provincia?: string
  cap?: string
  codiceFiscale?: string
}

export async function createCondomino(input: CreateCondominoInput): Promise<{ id?: string; error?: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { error: guard.error }
  const podPdr = input.podPdr.trim().toUpperCase()
  const cliente = input.cliente.trim()
  if (!podPdr) return { error: 'POD/PDR richiesto' }
  if (!cliente) return { error: 'Cliente richiesto' }

  const sb = createAdminClient()
  const { data: existing } = await sb.from('apulia_contacts').select('id').eq('pod_pdr', podPdr).maybeSingle()
  if (existing) return { error: `Esiste già un condominio con POD ${podPdr}` }

  const cf: Record<string, string | number> = {
    [APULIA_FIELD.POD_PDR]: podPdr,
    [APULIA_FIELD.CLIENTE]: cliente,
  }
  if (input.codiceAmministratore?.trim()) cf[APULIA_FIELD.CODICE_AMMINISTRATORE] = input.codiceAmministratore.trim()
  if (input.codiceFiscale?.trim()) cf[APULIA_FIELD.CODICE_FISCALE_AMMINISTRATORE] = input.codiceFiscale.trim()
  if (input.indirizzo?.trim()) cf['oCvfwCelHDn6gWEljqUJ'] = input.indirizzo.trim()
  if (input.comune?.trim()) cf['EXO9WD4aLV2aPiMYxXUU'] = input.comune.trim()
  if (input.provincia?.trim()) cf['opaPQWrWwDiaAeyoMbN5'] = input.provincia.trim()

  let newId: string
  try {
    newId = await upsertContact({
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      firstName: cliente,
      customField: cf,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Creazione fallita' }
  }
  if (!newId) return { error: 'ID non restituito' }

  await upsertCachedFromGhl({
    id: newId,
    firstName: cliente,
    email: input.email?.trim(),
    phone: input.phone?.trim(),
    customFields: Object.entries(cf).map(([id, value]) => ({ id, value: String(value) })),
  })

  revalidatePath('/designs/apulia-power/condomini')
  revalidatePath('/designs/apulia-power/dashboard')
  return { id: newId }
}

/** Delete many condomini in one shot. Best-effort: counts errors, never throws. */
export async function bulkDeleteCondomini(ids: string[]): Promise<{ deleted: number; failed: number; error?: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { deleted: 0, failed: 0, error: guard.error }
  if (ids.length === 0) return { deleted: 0, failed: 0 }

  const sb = createAdminClient()
  let deleted = 0, failed = 0
  await pmap(ids, async (id) => {
    try {
      await deleteContact(id)
      await sb.from('apulia_contacts').delete().eq('id', id)
      deleted++
    } catch {
      failed++
    }
  }, 6)

  revalidatePath('/designs/apulia-power/condomini')
  revalidatePath('/designs/apulia-power/dashboard')
  return { deleted, failed }
}
