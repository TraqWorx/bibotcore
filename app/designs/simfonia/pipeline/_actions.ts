'use server'

import { getGhlClient } from '@/lib/ghl/ghlClient'
import { assertUserOwnsLocation } from '@/lib/location/getActiveLocation'

export async function moveOpportunity(opportunityId: string, stageId: string, locationId: string) {
  await assertUserOwnsLocation(locationId)
  const ghl = await getGhlClient(locationId)
  await ghl.opportunities.updateStage(opportunityId, stageId)
}

export async function updateOpportunity(
  opportunityId: string,
  data: { name?: string; monetaryValue?: number; pipelineStageId?: string; status?: string },
  locationId: string
): Promise<{ error: string } | undefined> {
  try {
    await assertUserOwnsLocation(locationId)
    const ghl = await getGhlClient(locationId)
    await ghl.opportunities.update(opportunityId, data)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update' }
  }
}

export async function getDealData(dealId: string, locationId: string) {
  await assertUserOwnsLocation(locationId)
  const ghl = await getGhlClient(locationId)

  try {
    const oppData = await ghl.opportunities.get(dealId)
    const opportunity = oppData?.opportunity ?? null

    let contact = null
    let conversation = null
    let messages: { id: string; body?: string; direction?: string; dateAdded?: string }[] = []
    let notes: { id: string; body?: string; dateAdded?: string; createdBy?: string }[] = []
    let tasks: { id: string; title?: string; dueDate?: string; status?: string; completed?: boolean }[] = []
    let appointments: { id: string; title?: string; startTime?: string; appointmentStatus?: string }[] = []

    if (opportunity?.contactId) {
      const [cd, convData, notesData, tasksData, apptData] = await Promise.allSettled([
        ghl.contacts.get(opportunity.contactId),
        ghl.conversations.byContact(opportunity.contactId),
        ghl.notes.list(opportunity.contactId),
        ghl.tasks.list(opportunity.contactId),
        ghl.calendarEvents.byContact(opportunity.contactId),
      ])

      if (cd.status === 'fulfilled') contact = cd.value?.contact ?? null
      if (convData.status === 'fulfilled') {
        conversation = convData.value?.conversations?.[0] ?? null
        if (conversation?.id) {
          try {
            const msgData = await ghl.conversations.messages(conversation.id)
            const nested = msgData?.messages
            // GHL may return { messages: [...] } or { messages: { messages: [...] } }
            const rawMsgs = Array.isArray(nested) ? nested : nested?.messages ?? []
            messages = Array.isArray(rawMsgs) ? rawMsgs : []
          } catch { /* ignore */ }
        }
      }
      if (notesData.status === 'fulfilled') { const r = notesData.value?.notes; notes = Array.isArray(r) ? r : [] }
      if (tasksData.status === 'fulfilled') { const r = tasksData.value?.tasks; tasks = Array.isArray(r) ? r : [] }
      if (apptData.status === 'fulfilled') { const r = apptData.value?.events; appointments = Array.isArray(r) ? r : [] }
    }

    return { opportunity, contact, conversation, messages, notes, tasks, appointments }
  } catch (err) {
    console.error('getDealData failed:', err)
    return {
      opportunity: null, contact: null, conversation: null,
      messages: [], notes: [], tasks: [], appointments: [],
    }
  }
}


export async function deleteOpportunity(
  opportunityId: string,
  locationId: string
): Promise<{ error: string } | undefined> {
  try {
    await assertUserOwnsLocation(locationId)
    const ghl = await getGhlClient(locationId)
    await ghl.opportunities.delete(opportunityId)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete' }
  }
}

export async function createNote(
  contactId: string,
  body: string,
  locationId: string
): Promise<{ error: string } | undefined> {
  try {
    await assertUserOwnsLocation(locationId)
    const ghl = await getGhlClient(locationId)
    await ghl.notes.create(contactId, body)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save note' }
  }
}

export async function createTask(
  contactId: string,
  title: string,
  locationId: string,
  dueDate?: string
): Promise<{ error: string } | undefined> {
  try {
    await assertUserOwnsLocation(locationId)
    const ghl = await getGhlClient(locationId)
    await ghl.tasks.create(contactId, title, dueDate)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create task' }
  }
}

export async function completeTask(
  contactId: string,
  taskId: string,
  locationId: string
): Promise<{ error: string } | undefined> {
  try {
    await assertUserOwnsLocation(locationId)
    const ghl = await getGhlClient(locationId)
    await ghl.tasks.complete(contactId, taskId)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to complete task' }
  }
}

// Map GHL conversation type to valid message type
function resolveMessageType(convType?: string): string {
  if (!convType) return 'SMS'
  const t = convType.toUpperCase()
  if (t.includes('EMAIL')) return 'Email'
  if (t.includes('WHATSAPP')) return 'WhatsApp'
  if (t.includes('FB') || t.includes('FACEBOOK')) return 'FB'
  if (t.includes('IG') || t.includes('INSTAGRAM')) return 'IG'
  if (t.includes('LIVE_CHAT')) return 'Live_Chat'
  return 'SMS'
}

export async function sendMessage(
  conversationId: string,
  body: string,
  locationId: string,
  contactId?: string,
  type?: string
): Promise<{ error: string } | undefined> {
  try {
    await assertUserOwnsLocation(locationId)
    const ghl = await getGhlClient(locationId)
    await ghl.conversations.send(conversationId, body, { type: resolveMessageType(type), contactId })
  } catch (err) {
    console.error('sendMessage failed:', err)
    const { translateGhlError } = await import('@/lib/utils/ghlErrors')
    return { error: translateGhlError(err, 'Invio messaggio fallito') }
  }
}
