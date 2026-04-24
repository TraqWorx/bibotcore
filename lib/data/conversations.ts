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

const CONVO_COLUMNS = 'ghl_id, location_id, contact_ghl_id, contact_name, type, last_message_body, last_message_date, last_message_direction, unread_count, assigned_to'

export async function listConversations(
  locationId: string,
): Promise<{ conversations: CachedConversation[]; fromCache: boolean }> {
  const sb = createAdminClient()

  const [{ data: convos }, { data: metadata }] = await Promise.all([
    sb.from('cached_conversations')
      .select(CONVO_COLUMNS)
      .eq('location_id', locationId)
      .order('last_message_date', { ascending: false }),
    sb.from('conversation_metadata')
      .select('conversation_id, assigned_to')
      .eq('location_id', locationId),
  ])

  if (convos && convos.length > 0) {
    // Merge assigned_to from metadata
    if (metadata && metadata.length > 0) {
      const metaMap = new Map(metadata.map((m) => [m.conversation_id, m.assigned_to]))
      for (const c of convos) {
        const override = metaMap.get(c.ghl_id)
        if (override) (c as Record<string, unknown>).assigned_to = override
      }
    }
    return { conversations: convos as CachedConversation[], fromCache: true }
  }

  // Fallback to GHL
  return { conversations: await fetchFromGhl(locationId), fromCache: false }
}

async function fetchFromGhl(locationId: string): Promise<CachedConversation[]> {
  try {
    const ghl = await getGhlClient(locationId)
    const sb = createAdminClient()
    let allConvos: CachedConversation[] = []
    let startAfterId: string | undefined

    // Paginate through all conversations (GHL max 100 per request)
    for (let page = 0; page < 50; page++) {
      const query = `status=all&limit=100&sort=desc&sortBy=last_message_date${startAfterId ? `&startAfterId=${startAfterId}` : ''}`
      const data = await ghl.conversations.search(query)
      const convos: Record<string, unknown>[] = data?.conversations ?? []
      if (convos.length === 0) break

      const mapped = convos.map((c) => ({
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
      allConvos = allConvos.concat(mapped)
      startAfterId = convos[convos.length - 1]?.id as string | undefined

      if (convos.length < 100) break
    }

    // Cache in background
    if (allConvos.length > 0) {
      const rows = allConvos.map((c) => ({
        ghl_id: c.ghl_id, location_id: locationId, contact_ghl_id: c.contact_ghl_id,
        contact_name: c.contact_name, type: c.type, last_message_body: c.last_message_body,
        last_message_date: c.last_message_date, last_message_direction: c.last_message_direction,
        unread_count: c.unread_count, assigned_to: c.assigned_to,
        synced_at: new Date().toISOString(),
      }))
      Promise.resolve(sb.from('cached_conversations').upsert(rows, { onConflict: 'location_id,ghl_id' })).catch(() => {})
    }

    return allConvos
  } catch (err) {
    console.error('[fetchFromGhl conversations]', err instanceof Error ? err.message : err)
    return []
  }
}
