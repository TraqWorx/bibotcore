'use server'

import { revalidatePath } from 'next/cache'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { canAccessBibotDesign } from '@/lib/auth/designOwner'
import { enqueueOps, type QueueOpInput } from '@/lib/farmacia/sync-queue'
import { sanitizePhone } from '@/lib/farmacia/transform'
import { FARMACIA_TAG, FARMACIA_LOCATION_ID } from '@/lib/farmacia/fields'

async function assertOwner(): Promise<{ error?: string }> {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Non autenticato' }
  const sb = createAdminClient()
  const { data: p } = await sb.from('profiles').select('agency_id, role, location_id').eq('id', user.id).single()
  return (await canAccessBibotDesign(user.id, p, FARMACIA_LOCATION_ID)) ? {} : { error: 'Non autorizzato' }
}

function newId(): string { return globalThis.crypto.randomUUID() }

export async function createContact(fd: FormData): Promise<{ error?: string; id?: string }> {
  const guard = await assertOwner(); if (guard.error) return guard
  const firstName = (fd.get('first_name') as string | null)?.trim() || null
  const lastName = (fd.get('last_name') as string | null)?.trim() || null
  const email = (fd.get('email') as string | null)?.trim().toLowerCase() || null
  const phoneNorm = sanitizePhone(fd.get('phone') as string | null)
  if (!firstName && !lastName) return { error: 'Inserisci almeno il nome' }
  if (!phoneNorm && !email) return { error: 'Inserisci telefono o email' }

  const sb = createAdminClient()
  const id = newId()
  const { error } = await sb.from('farmacia_contacts').insert({
    id, first_name: firstName, last_name: lastName, email, phone: phoneNorm, phone_norm: phoneNorm,
    tags: [FARMACIA_TAG.CUSTOMER], sync_status: 'pending_create',
  })
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { error: 'Cliente con questo telefono già presente' }
    return { error: error.message }
  }
  await enqueueOps([{ contact_id: id, action: 'create' }])
  revalidatePath('/designs/farmacia-cialdella/clienti')
  return { id }
}

export async function updateContact(id: string, fd: FormData): Promise<{ error?: string }> {
  const guard = await assertOwner(); if (guard.error) return guard
  const phoneNorm = sanitizePhone(fd.get('phone') as string | null)
  const patch: Record<string, unknown> = {
    first_name: (fd.get('first_name') as string | null)?.trim() || null,
    last_name: (fd.get('last_name') as string | null)?.trim() || null,
    email: (fd.get('email') as string | null)?.trim().toLowerCase() || null,
    phone: phoneNorm, phone_norm: phoneNorm,
    sync_status: 'pending_update',
  }
  const sb = createAdminClient()
  const { error } = await sb.from('farmacia_contacts').update(patch).eq('id', id)
  if (error) return { error: error.message }
  await enqueueOps([{ contact_id: id, action: 'update' }])
  revalidatePath('/designs/farmacia-cialdella/clienti')
  return {}
}

export async function deleteContact(id: string): Promise<{ error?: string }> {
  const guard = await assertOwner(); if (guard.error) return guard
  const sb = createAdminClient()
  const { data: c } = await sb.from('farmacia_contacts').select('ghl_id').eq('id', id).maybeSingle()
  await sb.from('farmacia_contacts').update({ sync_status: 'pending_delete' }).eq('id', id)
  // Worker deletes from GHL (if ghl_id) and hard-deletes the row.
  await enqueueOps([{ contact_id: id, ghl_id: c?.ghl_id ?? null, action: 'delete' }])
  revalidatePath('/designs/farmacia-cialdella/clienti')
  return {}
}

export async function saveNotes(id: string, notes: string): Promise<{ error?: string }> {
  const guard = await assertOwner(); if (guard.error) return guard
  const sb = createAdminClient()
  const { error } = await sb.from('farmacia_contacts').update({ notes }).eq('id', id)
  return error ? { error: error.message } : {}
}

/** Replace a contact's tags; sync the diff (add/remove) to GHL. */
export async function setContactTags(id: string, tags: string[]): Promise<{ error?: string }> {
  const guard = await assertOwner(); if (guard.error) return guard
  const sb = createAdminClient()
  const { data: c } = await sb.from('farmacia_contacts').select('ghl_id, tags').eq('id', id).maybeSingle()
  const current = (c?.tags ?? []) as string[]
  const next = [...new Set(tags.map((t) => t.trim()).filter(Boolean))]
  const { error } = await sb.from('farmacia_contacts').update({ tags: next }).eq('id', id)
  if (error) return { error: error.message }
  if (c?.ghl_id) {
    const ops: QueueOpInput[] = []
    for (const t of next) if (!current.includes(t)) ops.push({ contact_id: id, ghl_id: c.ghl_id, action: 'add_tag', payload: { tag: t } })
    for (const t of current) if (!next.includes(t)) ops.push({ contact_id: id, ghl_id: c.ghl_id, action: 'remove_tag', payload: { tag: t } })
    if (ops.length) await enqueueOps(ops)
  }
  revalidatePath('/designs/farmacia-cialdella/clienti')
  return {}
}

export async function addTagToContact(id: string, tag: string): Promise<{ error?: string }> {
  const guard = await assertOwner(); if (guard.error) return guard
  const t = tag.trim(); if (!t) return { error: 'Tag vuoto' }
  const sb = createAdminClient()
  const { data: c } = await sb.from('farmacia_contacts').select('tags, ghl_id').eq('id', id).maybeSingle()
  const tags = [...new Set([...((c?.tags as string[] | null) ?? []), t])]
  const { error } = await sb.from('farmacia_contacts').update({ tags }).eq('id', id)
  if (error) return { error: error.message }
  if (c?.ghl_id) await enqueueOps([{ contact_id: id, ghl_id: c.ghl_id, action: 'add_tag', payload: { tag: t } }])
  revalidatePath('/designs/farmacia-cialdella/clienti')
  return {}
}

export async function removeTagFromContact(id: string, tag: string): Promise<{ error?: string }> {
  const guard = await assertOwner(); if (guard.error) return guard
  const sb = createAdminClient()
  const { data: c } = await sb.from('farmacia_contacts').select('tags, ghl_id').eq('id', id).maybeSingle()
  const tags = ((c?.tags as string[] | null) ?? []).filter((x) => x !== tag)
  const { error } = await sb.from('farmacia_contacts').update({ tags }).eq('id', id)
  if (error) return { error: error.message }
  if (c?.ghl_id) await enqueueOps([{ contact_id: id, ghl_id: c.ghl_id, action: 'remove_tag', payload: { tag } }])
  revalidatePath('/designs/farmacia-cialdella/clienti')
  return {}
}

export interface ContactOrder { id: string; order_ext_id: string; channel: string; order_date: string | null; total_cents: number | null; category: string | null }

export async function getContactOrders(id: string): Promise<ContactOrder[]> {
  const guard = await assertOwner(); if (guard.error) return []
  const sb = createAdminClient()
  const { data } = await sb.from('farmacia_orders')
    .select('id, order_ext_id, channel, order_date, total_cents, category')
    .eq('contact_id', id).order('order_date', { ascending: false, nullsFirst: false }).limit(100)
  return (data ?? []) as ContactOrder[]
}
