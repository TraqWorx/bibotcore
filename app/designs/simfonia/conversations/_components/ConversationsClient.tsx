'use client'

import useSWR from 'swr'
import SimfoniaPageHeader from '../../_components/SimfoniaPageHeader'
import { sf } from '@/lib/simfonia/ui'
import ConversationInbox from './ConversationInbox'
import type { ConversationItem, LocationUser, ConversationMessage, NoteItem } from '../_actions'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface DemoConversationData {
  conversations: ConversationItem[]
  users: LocationUser[]
  currentUserEmail?: string
  messagesByConversation?: Record<string, ConversationMessage[]>
  notesByContact?: Record<string, NoteItem[]>
}

export default function ConversationsClient({
  locationId,
  demoData,
  demoMode = false,
}: {
  locationId: string
  demoData?: DemoConversationData
  demoMode?: boolean
}) {
  const { data, isLoading } = useSWR(demoData ? null : `/api/conversations?locationId=${locationId}`, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  })

  const conversations: ConversationItem[] = demoData?.conversations ?? data?.conversations ?? []
  const users: LocationUser[] = demoData?.users ?? data?.users ?? []
  const currentUserEmail: string = demoData?.currentUserEmail ?? data?.currentUserEmail ?? ''

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-6 overflow-hidden">
      <SimfoniaPageHeader
        eyebrow="Messaggistica"
        title="Conversazioni"
        description="Inbox unificata: SMS, email, WhatsApp e altro."
      />
      {isLoading ? (
        <div className={`flex flex-1 items-center justify-center ${sf.emptyPanel} min-h-[320px]`}>
          <div className="text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
            <p className="mt-4 text-sm font-medium text-[var(--shell-muted)]">Caricamento conversazioni…</p>
          </div>
        </div>
      ) : (
        <ConversationInbox
          conversations={conversations}
          locationId={locationId}
          users={users}
          currentUserEmail={currentUserEmail}
          demoMode={demoMode}
          demoMessagesByConversation={demoData?.messagesByConversation}
          demoNotesByContact={demoData?.notesByContact}
        />
      )}
    </div>
  )
}
