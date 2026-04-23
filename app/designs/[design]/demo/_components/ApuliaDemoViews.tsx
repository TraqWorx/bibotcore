'use client'

import ContactsClient from '@/app/designs/apulia-tourism/contacts/_components/ContactsClient'
import ConversationsClient from '@/app/designs/apulia-tourism/conversations/_components/ConversationsClient'
import {
  apuliaTourismDemoConversations,
  apuliaTourismDemoConversationUsers,
  apuliaTourismDemoCurrentUserEmail,
  apuliaTourismDemoConversationMessages,
  apuliaTourismDemoContactNotes,
} from '../_lib/demoData'

export function ApuliaDemoContactsView() {
  return <ContactsClient locationId="demo-apulia-tourism" demoMode />
}

export function ApuliaDemoConversationsView() {
  return (
    <ConversationsClient
      locationId="demo-apulia-tourism"
      demoMode
      demoData={{
        conversations: apuliaTourismDemoConversations,
        users: apuliaTourismDemoConversationUsers,
        currentUserEmail: apuliaTourismDemoCurrentUserEmail,
        messagesByConversation: apuliaTourismDemoConversationMessages,
        notesByContact: apuliaTourismDemoContactNotes,
      }}
    />
  )
}
