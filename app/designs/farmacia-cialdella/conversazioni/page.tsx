import { createAdminClient } from '@/lib/supabase-server'
import { FARMACIA_LOCATION_ID } from '@/lib/farmacia/fields'
import ConversationsClient from './_components/ConversationsClient'

export const dynamic = 'force-dynamic'

interface CachedConvo {
  ghl_id: string
  contact_ghl_id: string | null
  contact_name: string | null
  type: string | null
  last_message_body: string | null
  last_message_date: string | null
}

export default async function ConversazioniPage() {
  // Read from the conversation cache for an instant load. A live GHL fetch on
  // every navigation was the main source of slowness; messages still load from
  // GHL on demand when a thread is opened.
  const sb = createAdminClient()
  const { data } = await sb
    .from('cached_conversations')
    .select('ghl_id, contact_ghl_id, contact_name, type, last_message_body, last_message_date')
    .eq('location_id', FARMACIA_LOCATION_ID)
    .order('last_message_date', { ascending: false, nullsFirst: false })
    .limit(200)
  const conversations = (data ?? []) as CachedConvo[]

  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Conversazioni</h1>
      <p style={{ color: 'var(--fc-text-muted)', marginBottom: 24 }}>WhatsApp e SMS via GoHighLevel.</p>
      <ConversationsClient
        conversations={conversations.map((c) => ({
          id: c.ghl_id,
          contactId: c.contact_ghl_id ?? '',
          name: c.contact_name,
          type: c.type,
          lastBody: c.last_message_body,
          lastDate: c.last_message_date,
        }))}
      />
    </div>
  )
}
