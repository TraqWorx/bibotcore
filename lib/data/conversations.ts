/**
 * Conversations data access layer — reads from Supabase cache.
 * Note: Individual messages are NOT cached — they always come from GHL.
 */

import { createAdminClient } from '@/lib/supabase-server'
import { getGhlClient } from '@/lib/ghl/ghlClient'

export type CachedConversation = {
  ghl_id: string
  location_id: string
  contact_ghl_id: string | null
  contact_name: string | null
  type: string | null
  last_message_body: string | null
  last_message_date: string | null
  last_message_direction: string | null
  unread_count: number
  assigned_to: string | null
  raw: Record<string, unknown> | null
}

async function isCacheReady(locationId: string): Promise<boolean> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('sync_status')
    .select('status')
    .eq('location_id', locationId)
    .eq('entity_type', 'conversations')
    .single()
  return data?.status === 'completed'
}

export async function listConversations(
  locationId: string,
): Promise<{ conversations: CachedConversation[]; fromCache: boolean }> {
  const cacheReady = await isCacheReady(locationId)

  if (!cacheReady) {
    return { conversations: await fetchFromGhl(locationId), fromCache: false }
  }

  const sb = createAdminClient()
  const { data } = await sb
    .from('cached_conversations')
    .select('*')
    .eq('location_id', locationId)
    .order('last_message_date', { ascending: false })

  // Merge with conversation_metadata for assigned_to overrides
  const convos = data ?? []
  if (convos.length > 0) {
    const convoIds = convos.map((c) => c.ghl_id)
    const { data: metadata } = await sb
      .from('conversation_metadata')
      .select('conversation_id, assigned_to')
      .eq('location_id', locationId)
      .in('conversation_id', convoIds)

    if (metadata && metadata.length > 0) {
      const metaMap = new Map(metadata.map((m) => [m.conversation_id, m.assigned_to]))
      for (const c of convos) {
        const override = metaMap.get(c.ghl_id)
        if (override) c.assigned_to = override
      }
    }
  }

  return { conversations: convos, fromCache: true }
}

async function fetchFromGhl(locationId: string): Promise<CachedConversation[]> {
  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.conversations.search('status=all&limit=100&sort=desc&sortBy=last_message_date')
    const convos: Record<string, unknown>[] = data?.conversations ?? []
    return convos.map((c) => ({
      ghl_id: c.id as string,
      location_id: locationId,
      contact_ghl_id: (c.contactId as string) ?? null,
      contact_name: (c.fullName as string) ?? (c.contactName as string) ?? null,
      type: (c.type as string) ?? null,
      last_message_body: (c.lastMessageBody as string) ?? null,
      last_message_date: (c.lastMessageDate as string) ?? null,
      last_message_direction: (c.lastMessageDirection as string) ?? null,
      unread_count: typeof c.unreadCount === 'number' ? c.unreadCount : 0,
      assigned_to: (c.assignedTo as string) ?? null,
      raw: c,
    }))
  } catch {
    return []
  }
}
