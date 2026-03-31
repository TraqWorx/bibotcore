'use server'

import { revalidatePath } from 'next/cache'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import { assertUserOwnsLocation } from '@/lib/location/getActiveLocation'
import { getUniqueFields } from '../settings/_actions'
import { writeThroughContact, writeThroughContactDelete } from '@/lib/sync/writeThrough'

export interface ContactDetail {
  id: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  companyName?: string
  address1?: string
  city?: string
  tags?: string[]
  customFields?: { id: string; value?: string; field_value?: string; fieldValue?: string; key?: string; name?: string }[]
  opportunities?: { id: string; name?: string; stageName?: string; monetaryValue?: number }[]
  conversations?: { id: string; type?: string; lastMessageBody?: string; lastMessageDate?: string }[]
}

export async function getContactDetail(
  locationId: string,
  contactId: string
): Promise<ContactDetail | null> {
  try {
    const { getContact, getContactCustomFields } = await import('@/lib/data/contacts')
    const { getOpportunitiesByContact } = await import('@/lib/data/opportunities')
    const { listPipelines } = await import('@/lib/data/pipelines')

    const [cached, customFieldValues, cachedOpps, { pipelines }] = await Promise.all([
      getContact(locationId, contactId),
      getContactCustomFields(locationId, contactId),
      getOpportunitiesByContact(locationId, contactId),
      listPipelines(locationId),
    ])

    // If not in cache, fall back to GHL
    if (!cached) {
      const ghl = await getGhlClient(locationId)
      const contactData = await ghl.contacts.get(contactId)
      const contact = contactData?.contact
      if (!contact) return null
      return {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        companyName: contact.companyName,
        address1: contact.address1,
        city: contact.city,
        tags: contact.tags ?? [],
        customFields: contact.customFields ?? [],
      }
    }

    // Build stage name map from cached pipelines
    const stageMap: Record<string, string> = {}
    for (const pipeline of pipelines) {
      for (const stage of pipeline.stages ?? []) {
        stageMap[stage.id] = stage.name
      }
    }

    const opportunities = cachedOpps.map((opp) => ({
      id: opp.ghl_id,
      name: opp.name ?? undefined,
      stageName: opp.pipeline_stage_id ? stageMap[opp.pipeline_stage_id] ?? '—' : '—',
      monetaryValue: Number(opp.monetary_value) || 0,
    }))

    // Build customFields array from cached raw data or EAV table
    const rawCustomFields = cached.raw && Array.isArray((cached.raw as Record<string, unknown>).customFields)
      ? ((cached.raw as Record<string, unknown>).customFields as { id: string; value?: string; field_value?: string; fieldValue?: string }[])
      : customFieldValues.map((cf) => ({ id: cf.field_id, value: cf.value ?? '', field_value: cf.value ?? '' }))

    return {
      id: cached.ghl_id,
      firstName: cached.first_name ?? undefined,
      lastName: cached.last_name ?? undefined,
      email: cached.email ?? undefined,
      phone: cached.phone ?? undefined,
      companyName: cached.company_name ?? undefined,
      address1: cached.address1 ?? undefined,
      city: cached.city ?? undefined,
      tags: cached.tags ?? [],
      customFields: rawCustomFields,
      opportunities,
    }
  } catch {
    return null
  }
}

export async function sendMessageToContact(
  locationId: string,
  contactId: string,
  message: string,
  type: 'SMS' | 'Email' | 'WhatsApp'
): Promise<{ error?: string }> {
  try {
    const ghl = await getGhlClient(locationId)

    // First get or create a conversation
    const convData = await ghl.conversations.byContact(contactId).catch(() => null)
    const conversation = convData?.conversations?.[0]
    const conversationId = conversation?.id

    if (!conversationId) {
      return { error: 'Nessuna conversazione trovata per questo contatto' }
    }

    // Map conversation type to send message type
    // GHL conversations return types like "TYPE_PHONE", "TYPE_EMAIL", etc.
    // but the send endpoint expects "SMS", "Email", "WhatsApp", etc.
    const TYPE_MAP: Record<string, string> = {
      TYPE_PHONE: 'SMS',
      TYPE_EMAIL: 'Email',
      TYPE_WHATSAPP: 'WhatsApp',
      TYPE_SMS: 'SMS',
      TYPE_FB: 'FB',
      TYPE_IG: 'IG',
      TYPE_LIVE_CHAT: 'Live_Chat',
      // Pass through if already in correct format
      SMS: 'SMS',
      Email: 'Email',
      WhatsApp: 'WhatsApp',
    }
    const rawType = conversation?.type || type
    const msgType = TYPE_MAP[rawType] ?? type
    await ghl.conversations.send(conversationId, message, { type: msgType, contactId })
    return {}
  } catch (err) {
    console.error('[sendMessage] FAILED:', err instanceof Error ? err.message : err)
    const { translateGhlError } = await import('@/lib/utils/ghlErrors')
    return { error: translateGhlError(err, 'Invio messaggio fallito') }
  }
}

export interface ConversationMessage {
  id: string
  body?: string
  message?: string
  direction?: string
  type?: string
  dateAdded?: string
  status?: string
  contactId?: string
}

export async function getConversationMessages(
  locationId: string,
  contactId: string
): Promise<{ conversationId: string | null; type: string | null; messages: ConversationMessage[] }> {
  try {
    const ghl = await getGhlClient(locationId)
    const convData = await ghl.conversations.byContact(contactId).catch(() => null)
    const conversation = convData?.conversations?.[0]
    if (!conversation?.id) return { conversationId: null, type: null, messages: [] }

    // Paginate through ALL messages
    let allMessages: Record<string, unknown>[] = []
    let lastMessageId: string | undefined
    let page = 0
    while (page < 10) { // max 10 pages = 500 messages
      const url = lastMessageId
        ? `/conversations/${conversation.id}/messages?limit=50&lastMessageId=${lastMessageId}`
        : `/conversations/${conversation.id}/messages?limit=50`
      const msgData = await ghl.conversations.messages_raw(url).catch(() => null)
      const nested = msgData?.messages
      const pageMessages: Record<string, unknown>[] = Array.isArray(nested) ? nested : nested?.messages ?? []
      if (pageMessages.length === 0) break
      allMessages = allMessages.concat(pageMessages)
      const hasNext = Array.isArray(nested) ? false : nested?.nextPage === true
      lastMessageId = Array.isArray(nested) ? undefined : nested?.lastMessageId
      page++
      if (!hasNext || !lastMessageId) break
    }
    const rawMessages = allMessages
    const messages = (rawMessages as unknown as ConversationMessage[])
      .map((m) => ({
        id: m.id,
        body: m.body ?? m.message ?? '',
        direction: m.direction,
        type: m.type,
        dateAdded: m.dateAdded,
        status: m.status,
      }))
      .sort((a, b) => new Date(a.dateAdded ?? 0).getTime() - new Date(b.dateAdded ?? 0).getTime())

    return { conversationId: conversation.id, type: conversation.type ?? null, messages }
  } catch {
    return { conversationId: null, type: null, messages: [] }
  }
}

export async function updateContact(
  locationId: string,
  contactId: string,
  data: Record<string, unknown>
): Promise<{ error?: string }> {
  try {
    await assertUserOwnsLocation(locationId)
    const ghl = await getGhlClient(locationId)
    const result = await ghl.contacts.update(contactId, data)
    // Write-through: update cache with the returned contact data
    const updatedContact = result?.contact ?? { ...data, id: contactId }
    writeThroughContact(ghl.locationId, updatedContact as Record<string, unknown>)
    revalidatePath('/designs/simfonia/contacts', 'page')
    revalidatePath('/designs/simfonia/dashboard', 'page')
    return {}
  } catch (err) {
    console.error('[updateContact] FAILED:', err instanceof Error ? err.message : err)
    const { translateGhlError } = await import('@/lib/utils/ghlErrors')
    return { error: translateGhlError(err, 'Errore nel salvataggio') }
  }
}

export async function deleteContact(
  locationId: string,
  contactId: string
): Promise<{ error?: string }> {
  try {
    await assertUserOwnsLocation(locationId)
    const ghl = await getGhlClient(locationId)
    await ghl.contacts.delete(contactId)
    // Write-through: remove from cache
    writeThroughContactDelete(ghl.locationId, contactId)
    revalidatePath('/designs/simfonia/contacts', 'page')
    revalidatePath('/designs/simfonia/dashboard', 'page')
    return {}
  } catch (err) {
    const { translateGhlError } = await import('@/lib/utils/ghlErrors')
    return { error: translateGhlError(err, 'Errore nella cancellazione') }
  }
}

// ─── Unique Field Validation ────────────────────────────────────────────────

import { createAdminClient } from '@/lib/supabase-server'

/**
 * Check if any unique fields have duplicate values among existing contacts.
 * Uses the Supabase cached_contact_custom_fields table for fast lookups.
 * `excludeContactId` is used during edit to skip the current contact.
 */
export async function checkUniqueFieldDuplicates(
  locationId: string,
  fieldValues: { id: string; value: string }[],
  excludeContactId?: string
): Promise<Record<string, string>> {
  const errors: Record<string, string> = {}

  // Get configured unique fields
  const uniqueFieldIds = await getUniqueFields(locationId)
  if (uniqueFieldIds.length === 0) return errors

  // Filter to only fields that have a value and are marked as unique
  const fieldsToCheck = fieldValues.filter(
    (f) => f.value.trim() && uniqueFieldIds.includes(f.id)
  )
  if (fieldsToCheck.length === 0) return errors

  const sb = createAdminClient()

  // Check each unique field for duplicates using the cache
  for (const field of fieldsToCheck) {
    const normalizedValue = field.value.trim().toLowerCase()

    let query = sb
      .from('cached_contact_custom_fields')
      .select('contact_ghl_id, value')
      .eq('location_id', locationId)
      .eq('field_id', field.id)
      .ilike('value', normalizedValue)
      .limit(1)

    if (excludeContactId) {
      query = query.neq('contact_ghl_id', excludeContactId)
    }

    const { data } = await query
    if (data && data.length > 0) {
      errors[field.id] = `Valore già presente in un altro contatto`
    }
  }

  return errors
}
