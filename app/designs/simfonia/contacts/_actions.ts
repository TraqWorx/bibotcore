'use server'

import { revalidatePath } from 'next/cache'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import { assertUserOwnsLocation } from '@/lib/location/getActiveLocation'

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
    const ghl = await getGhlClient(locationId)

    const [contactData, opportunitiesData, pipelinesData, conversationsData] = await Promise.all([
      ghl.contacts.get(contactId),
      ghl.opportunities.byContact(contactId),
      ghl.pipelines.list(),
      ghl.conversations.byContact(contactId).catch(() => null),
    ])

    const contact = contactData?.contact
    if (!contact) return null

    // Build stage name map
    const stageMap: Record<string, string> = {}
    for (const pipeline of pipelinesData?.pipelines ?? []) {
      for (const stage of pipeline.stages ?? []) {
        stageMap[stage.id] = stage.name
      }
    }

    const opportunities = (opportunitiesData?.opportunities ?? []).map(
      (opp: { id: string; name?: string; pipelineStageId?: string; monetaryValue?: number }) => ({
        id: opp.id,
        name: opp.name,
        stageName: opp.pipelineStageId ? stageMap[opp.pipelineStageId] ?? '—' : '—',
        monetaryValue: opp.monetaryValue ?? 0,
      })
    )

    const conversations = (conversationsData?.conversations ?? [])
      .slice(0, 5)
      .map((c: { id: string; type?: string; lastMessageBody?: string; lastMessageDate?: string }) => ({
        id: c.id,
        type: c.type,
        lastMessageBody: c.lastMessageBody,
        lastMessageDate: c.lastMessageDate,
      }))

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
      opportunities,
      conversations,
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
    await ghl.contacts.update(contactId, data)
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
    revalidatePath('/designs/simfonia/contacts', 'page')
    revalidatePath('/designs/simfonia/dashboard', 'page')
    return {}
  } catch (err) {
    const { translateGhlError } = await import('@/lib/utils/ghlErrors')
    return { error: translateGhlError(err, 'Errore nella cancellazione') }
  }
}
