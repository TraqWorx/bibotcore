'use client'

import useSWR from 'swr'
import SimfoniaPageHeader from '../../_components/SimfoniaPageHeader'
import { sf } from '@/lib/simfonia/ui'
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
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-6">
      <SimfoniaPageHeader
        eyebrow="Messaggistica"
        title="Conversazioni"
        description="Inbox unificata: SMS, email, WhatsApp e altro da GHL."
      />
      {isLoading ? (
        <div className={`flex flex-1 items-center justify-center ${sf.emptyPanel} min-h-[320px]`}>
          <div className="text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
            <p className="mt-4 text-sm font-medium text-gray-500">Caricamento conversazioni…</p>
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
