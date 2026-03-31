import { redirect } from 'next/navigation'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { createAuthClient } from '@/lib/supabase-server'
import { getConversations, getLocationUsers } from './_actions'
import ConversationInbox from './_components/ConversationInbox'

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const locationId = await getActiveLocation(sp).catch(() => null)
  if (!locationId) redirect('/login')

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  const [conversations, users] = await Promise.all([
    getConversations(locationId),
    getLocationUsers(locationId),
  ])

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Conversazioni</h1>
      <ConversationInbox
        conversations={conversations}
        locationId={locationId}
        users={users}
        currentUserEmail={user?.email ?? ''}
      />
    </div>
  )
}
