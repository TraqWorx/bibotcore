'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { APULIA_FIELD } from '@/lib/apulia/fields'
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

/**
 * Manually create one condominio — DB-first. INSERTs a fresh uuid row with
 * sync_status='pending_create' and ghl_id=null; the worker pushes to GHL.
 */
export async function createCondomino(input: CreateCondominoInput): Promise<{ id?: string; error?: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { error: guard.error }
  const podPdr = input.podPdr.trim().toUpperCase()
  const cliente = input.cliente.trim()
  if (!podPdr) return { error: 'POD/PDR richiesto' }
  if (!cliente) return { error: 'Cliente richiesto' }

  const sb = createAdminClient()
  const { data: existing } = await sb
    .from('apulia_contacts')
    .select('id')
    .eq('pod_pdr', podPdr)
    .neq('sync_status', 'pending_delete')
    .maybeSingle()
  if (existing) return { error: `Esiste già un condominio con POD ${podPdr}` }

  const cf: Record<string, string> = {
    [APULIA_FIELD.POD_PDR]: podPdr,
    [APULIA_FIELD.CLIENTE]: cliente,
  }
  if (input.codiceAmministratore?.trim()) cf[APULIA_FIELD.CODICE_AMMINISTRATORE] = input.codiceAmministratore.trim()
  if (input.codiceFiscale?.trim()) cf[APULIA_FIELD.CODICE_FISCALE_AMMINISTRATORE] = input.codiceFiscale.trim()
  if (input.indirizzo?.trim()) cf['oCvfwCelHDn6gWEljqUJ'] = input.indirizzo.trim()
  if (input.comune?.trim()) cf['EXO9WD4aLV2aPiMYxXUU'] = input.comune.trim()
  if (input.provincia?.trim()) cf['opaPQWrWwDiaAeyoMbN5'] = input.provincia.trim()

  // If we know the codice, also denormalize the admin name to the row.
  let adminName: string | null = null
  if (input.codiceAmministratore?.trim()) {
    const { data: admin } = await sb
      .from('apulia_contacts')
      .select('first_name, last_name')
      .eq('is_amministratore', true)
      .eq('codice_amministratore', input.codiceAmministratore.trim())
      .neq('sync_status', 'pending_delete')
      .maybeSingle()
    adminName = admin ? [admin.first_name, admin.last_name].filter(Boolean).join(' ') : null
    if (adminName) cf[APULIA_FIELD.AMMINISTRATORE_CONDOMINIO] = adminName
  }

  const id = randomUUID()
  const { error } = await sb.from('apulia_contacts').insert({
    id,
    ghl_id: null,
    sync_status: 'pending_create',
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    first_name: cliente,
    last_name: null,
    tags: [],
    custom_fields: cf,
    pod_pdr: podPdr,
    codice_amministratore: input.codiceAmministratore?.trim() || null,
    amministratore_name: adminName,
    cliente,
    comune: input.comune?.trim() || null,
    stato: null,
    compenso_per_pod: null,
    pod_override: null,
    commissione_totale: null,
    is_amministratore: false,
    is_switch_out: false,
    ghl_updated_at: null,
  })
  if (error) return { error: error.message }

  await enqueueOp({ contact_id: id, ghl_id: null, action: 'create' })

  revalidatePath('/designs/apulia-power/condomini')
  revalidatePath('/designs/apulia-power/dashboard')
  return { id }
}

export interface BulkDeleteFilters {
  q?: string
  stato?: 'active' | 'switch_out'
  comune?: string
  amministratore?: string
}

/**
 * Soft-delete many condomini at once. Worker hard-deletes from
 * apulia_contacts after each GHL ack.
 */
export async function bulkDeleteCondomini(input: { ids?: string[]; filters?: BulkDeleteFilters }): Promise<{ deleted: number; failed: number; error?: string }> {
  const guard = await ensureOwner()
  if ('error' in guard) return { deleted: 0, failed: 0, error: guard.error }

  const sb = createAdminClient()
  let ids: string[] = []
  if (input.ids && input.ids.length > 0) {
    ids = input.ids
  } else if (input.filters) {
    let q = sb.from('apulia_contacts').select('id').eq('is_amministratore', false).neq('sync_status', 'pending_delete')
    const f = input.filters
    if (f.stato === 'active') q = q.eq('is_switch_out', false)
    else if (f.stato === 'switch_out') q = q.eq('is_switch_out', true)
    if (f.comune) q = q.eq('comune', f.comune)
    if (f.amministratore) q = q.eq('amministratore_name', f.amministratore)
    if (f.q) {
      const term = f.q.replace(/[%_]/g, (m) => `\\${m}`)
      q = q.or(`pod_pdr.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,cliente.ilike.%${term}%,amministratore_name.ilike.%${term}%`)
    }
    const { data } = await q
    ids = (data ?? []).map((r) => r.id as string)
  }
  if (ids.length === 0) return { deleted: 0, failed: 0 }

  const { data: rows } = await sb.from('apulia_contacts').select('id, ghl_id').in('id', ids)
  if (!rows?.length) return { deleted: 0, failed: 0 }

  const localOnly = rows.filter((r) => !r.ghl_id).map((r) => r.id)
  const remote = rows.filter((r) => r.ghl_id) as Array<{ id: string; ghl_id: string }>

  if (localOnly.length) {
    await sb.from('apulia_sync_queue').delete().in('contact_id', localOnly).eq('status', 'pending')
    await sb.from('apulia_contacts').delete().in('id', localOnly)
  }
  if (remote.length) {
    await sb.from('apulia_contacts').update({ sync_status: 'pending_delete' }).in('id', remote.map((r) => r.id))
    await enqueueOps(remote.map((r) => ({ contact_id: r.id, ghl_id: r.ghl_id, action: 'delete' as const })))
  }

  revalidatePath('/designs/apulia-power/condomini')
  revalidatePath('/designs/apulia-power/dashboard')
  return { deleted: rows.length, failed: 0 }
}
