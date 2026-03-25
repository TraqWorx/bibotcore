'use server'

import { getGhlClient } from '@/lib/ghl/ghlClient'

export interface ConversationItem {
  id: string
  contactId: string
  contactName: string
  type: string
  lastMessageBody: string
  lastMessageDate: string
  lastMessageDirection: string
  unreadCount: number
}

export interface ConversationMessage {
  id: string
  body: string
  direction: string
  type?: string | number
  dateAdded: string
  status?: string
}

export async function getConversations(
  locationId: string
): Promise<ConversationItem[]> {
  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.conversations.search('status=all&limit=50&sort=desc&sortBy=last_message_date')

    const conversations = (data?.conversations ?? []).map(
      (c: {
        id: string
        contactId?: string
        fullName?: string
        contactName?: string
        type?: string
        lastMessageBody?: string
        lastMessageDate?: string
        lastMessageDirection?: string
        unreadCount?: number
      }) => ({
        id: c.id,
        contactId: c.contactId ?? '',
        contactName: c.fullName ?? c.contactName ?? 'Sconosciuto',
        type: c.type ?? '',
        lastMessageBody: c.lastMessageBody ?? '',
        lastMessageDate: c.lastMessageDate ?? '',
        lastMessageDirection: c.lastMessageDirection ?? '',
        unreadCount: c.unreadCount ?? 0,
      })
    )

    // Sort by last message date desc (unread still bolded but not pushed to top)
    conversations.sort((a: ConversationItem, b: ConversationItem) =>
      new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()
    )

    return conversations
  } catch (err) {
    console.error('[getConversations]', err instanceof Error ? err.message : err)
    return []
  }
}

export async function getConversationMessages(
  locationId: string,
  conversationId: string
): Promise<ConversationMessage[]> {
  try {
    const ghl = await getGhlClient(locationId)

    // Paginate to get all messages
    let allMessages: Record<string, unknown>[] = []
    let lastMessageId: string | undefined
    let page = 0
    while (page < 10) {
      const url = lastMessageId
        ? `/conversations/${conversationId}/messages?limit=50&lastMessageId=${lastMessageId}`
        : `/conversations/${conversationId}/messages?limit=50`
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

    return allMessages
      .map((m) => ({
        id: String(m.id),
        body: String(m.body ?? m.message ?? ''),
        direction: String(m.direction ?? ''),
        type: m.type as string | number | undefined,
        dateAdded: String(m.dateAdded ?? ''),
        status: m.status as string | undefined,
      }))
      .filter((m) => m.body)
      .sort((a, b) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime())
  } catch {
    return []
  }
}

export async function sendMessage(
  locationId: string,
  conversationId: string,
  contactId: string,
  message: string,
  type: string
): Promise<{ error?: string }> {
  try {
    const ghl = await getGhlClient(locationId)

    const TYPE_MAP: Record<string, string> = {
      TYPE_PHONE: 'SMS',
      TYPE_EMAIL: 'Email',
      TYPE_WHATSAPP: 'WhatsApp',
      TYPE_SMS: 'SMS',
      TYPE_FB: 'FB',
      TYPE_IG: 'IG',
      TYPE_LIVE_CHAT: 'Live_Chat',
      SMS: 'SMS',
      Email: 'Email',
      WhatsApp: 'WhatsApp',
    }
    const msgType = TYPE_MAP[type] ?? 'SMS'

    await ghl.conversations.send(conversationId, message, { type: msgType, contactId })
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invio fallito' }
  }
}
