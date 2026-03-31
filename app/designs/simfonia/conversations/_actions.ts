'use server'

import { getGhlClient } from '@/lib/ghl/ghlClient'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'
import { createAdminClient } from '@/lib/supabase-server'
import { writeThroughNote, writeThroughNoteDelete } from '@/lib/sync/writeThrough'

const BASE_URL = 'https://services.leadconnectorhq.com'

export interface ConversationItem {
  id: string
  contactId: string
  contactName: string
  type: string
  lastMessageBody: string
  lastMessageDate: string
  lastMessageDirection: string
  unreadCount: number
  assignedTo?: string
}

export interface NoteItem {
  id: string
  body: string
  dateAdded: string
  createdBy?: string
}

export interface LocationUser {
  id: string
  name: string
  email: string
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
    const { listConversations } = await import('@/lib/data/conversations')
    const { conversations: cached } = await listConversations(locationId)

    return cached.map((c) => ({
      id: c.ghl_id,
      contactId: c.contact_ghl_id ?? '',
      contactName: c.contact_name ?? 'Sconosciuto',
      type: c.type ?? '',
      lastMessageBody: c.last_message_body ?? '',
      lastMessageDate: c.last_message_date ?? '',
      lastMessageDirection: c.last_message_direction ?? '',
      unreadCount: c.unread_count ?? 0,
      assignedTo: c.assigned_to ?? '',
    }))
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
    const { translateGhlError } = await import('@/lib/utils/ghlErrors')
    return { error: translateGhlError(err, 'Invio messaggio fallito') }
  }
}

export async function getContactNotes(
  locationId: string,
  contactId: string
): Promise<NoteItem[]> {
  try {
    const ghl = await getGhlClient(locationId)
    const [data, authorData] = await Promise.all([
      ghl.notes.list(contactId),
      createAdminClient()
        .from('note_authors')
        .select('note_id, author_user_id')
        .eq('location_id', locationId)
        .eq('contact_id', contactId)
        .then(r => r.data ?? []),
    ])

    const authorMap = new Map(
      authorData.map((a: { note_id: string; author_user_id: string }) => [a.note_id, a.author_user_id])
    )

    const raw = data?.notes ?? []
    const notes: NoteItem[] = raw.map(
      (n: Record<string, unknown>) => {
        const noteId = String(n.id ?? '')
        // GHL returns userId=null for API-created notes, so check Supabase first
        const ghlUserId = n.userId ? String(n.userId) : ''
        const creator = authorMap.get(noteId) ?? ghlUserId
        return {
          id: noteId,
          body: String(n.body ?? ''),
          dateAdded: String(n.dateAdded ?? ''),
          createdBy: creator,
        }
      }
    )
    return notes.sort(
      (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
    )
  } catch {
    return []
  }
}

export async function deleteContactNote(
  locationId: string,
  contactId: string,
  noteId: string
): Promise<{ error?: string }> {
  try {
    const ghl = await getGhlClient(locationId)
    await ghl.notes.delete(contactId, noteId)
    writeThroughNoteDelete(locationId, noteId)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Errore eliminazione nota' }
  }
}

export async function updateContactNote(
  locationId: string,
  contactId: string,
  noteId: string,
  body: string
): Promise<{ error?: string }> {
  try {
    const ghl = await getGhlClient(locationId)
    await ghl.notes.update(contactId, noteId, body)
    writeThroughNote(locationId, contactId, { id: noteId, body })
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Errore aggiornamento nota' }
  }
}

export async function createContactNote(
  locationId: string,
  contactId: string,
  body: string,
  authorUserId?: string
): Promise<{ error?: string }> {
  try {
    const ghl = await getGhlClient(locationId)
    const result = await ghl.notes.create(contactId, body)

    // Save author in Supabase (GHL returns userId=null for API-created notes)
    const noteId = result?.id ?? result?.note?.id
    if (noteId) {
      if (authorUserId) {
        const supabase = createAdminClient()
        await supabase.from('note_authors').insert({
          location_id: locationId,
          contact_id: contactId,
          note_id: String(noteId),
          author_user_id: authorUserId,
        })
      }
      // Write-through: add to cache
      writeThroughNote(locationId, contactId, result?.note ?? result)
    }

    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Errore creazione nota' }
  }
}

export async function getLocationUsers(
  locationId: string
): Promise<LocationUser[]> {
  try {
    const token = await getGhlTokenForLocation(locationId)
    const res = await fetch(`${BASE_URL}/users/?locationId=${locationId}`, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return ((data?.users ?? []) as { id: string; name?: string; firstName?: string; lastName?: string; email?: string }[]).map((u) => ({
      id: u.id,
      name: u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id),
      email: u.email ?? '',
    }))
  } catch {
    return []
  }
}

export async function assignConversation(
  locationId: string,
  conversationId: string,
  userId: string
): Promise<{ error?: string }> {
  try {
    // Always persist in Supabase first (GHL search doesn't return assignedTo)
    const supabase = createAdminClient()
    const { error: upsertErr } = await supabase.from('conversation_metadata').upsert(
      { location_id: locationId, conversation_id: conversationId, assigned_to: userId || null, updated_at: new Date().toISOString() },
      { onConflict: 'location_id,conversation_id' }
    )
    if (upsertErr) console.error('[assignConversation] supabase upsert error:', upsertErr)
    else console.log('[assignConversation] saved to supabase:', conversationId, '->', userId)

    // Also try to update in GHL (best effort)
    try {
      const token = await getGhlTokenForLocation(locationId)
      await fetch(`${BASE_URL}/conversations/${conversationId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-04-15',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignedTo: userId || null }),
      })
    } catch (ghlErr) {
      console.error('[assignConversation] GHL PUT failed (non-blocking):', ghlErr)
    }

    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Assegnazione fallita' }
  }
}
