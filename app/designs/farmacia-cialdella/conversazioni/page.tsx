import { listConversations } from '@/lib/data/conversations'
import { FARMACIA_LOCATION_ID } from '@/lib/farmacia/fields'
import ConversationsClient from './_components/ConversationsClient'

export const dynamic = 'force-dynamic'

export default async function ConversazioniPage() {
  let conversations: Awaited<ReturnType<typeof listConversations>>['conversations'] = []
  let error: string | null = null
  try {
    const res = await listConversations(FARMACIA_LOCATION_ID)
    conversations = res.conversations
  } catch (e) {
    error = e instanceof Error ? e.message : 'Impossibile caricare le conversazioni'
  }

  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Conversazioni</h1>
      <p style={{ color: 'var(--fc-text-muted)', marginBottom: 24 }}>WhatsApp e SMS via GoHighLevel.</p>
      {error ? (
        <div className="fc-card" style={{ padding: 24, color: 'var(--fc-danger)' }}>{error}</div>
      ) : (
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
      )}
    </div>
  )
}
