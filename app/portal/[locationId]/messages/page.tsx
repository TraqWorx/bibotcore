import { redirect } from 'next/navigation'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import PortalMessages from './_components/PortalMessages'

export default async function PortalMessagesPage({
  params,
}: {
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect(`/portal/login?locationId=${locationId}`)

  const sb = createAdminClient()
  const { data: portalUser } = await sb
    .from('portal_users')
    .select('contact_ghl_id')
    .eq('auth_user_id', user.id)
    .single()

  if (!portalUser) redirect(`/portal/login?locationId=${locationId}`)

  // Get conversations for this contact
  const { data: conversations } = await sb
    .from('cached_conversations')
    .select('ghl_id, type, contact_name, last_message_body, last_message_date, last_message_direction')
    .eq('location_id', locationId)
    .eq('contact_ghl_id', portalUser.contact_ghl_id)
    .order('last_message_date', { ascending: false })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Messaggi</h1>
      <PortalMessages
        locationId={locationId}
        contactGhlId={portalUser.contact_ghl_id}
        conversations={conversations ?? []}
      />
    </div>
  )
}
