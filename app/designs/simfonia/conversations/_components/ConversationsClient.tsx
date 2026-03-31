'use client'

import useSWR from 'swr'
import ConversationInbox from './ConversationInbox'
import type { ConversationItem, LocationUser } from '../_actions'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function ConversationsClient({ locationId }: { locationId: string }) {
  const { data, isLoading } = useSWR(`/api/conversations?locationId=${locationId}`, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  })

  const conversations: ConversationItem[] = data?.conversations ?? []
  const users: LocationUser[] = data?.users ?? []
  const currentUserEmail: string = data?.currentUserEmail ?? ''

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Conversazioni</h1>
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#2A00CC]" />
            <p className="mt-3 text-sm text-gray-400">Caricamento conversazioni...</p>
          </div>
        </div>
      ) : (
        <ConversationInbox
          conversations={conversations}
          locationId={locationId}
          users={users}
          currentUserEmail={currentUserEmail}
        />
      )}
    </div>
  )
}
