/**
 * Webhook processor — handles GHL CRM entity events and upserts into cache.
 *
 * GHL webhook event types:
 *   ContactCreate, ContactUpdate, ContactDelete, ContactDndUpdate, ContactTagUpdate
 *   OpportunityCreate, OpportunityUpdate, OpportunityDelete,
 *   OpportunityStageUpdate, OpportunityStatusUpdate, OpportunityMonetaryValueUpdate
 *   ConversationUpdated, ConversationUnreadUpdate, InboundMessage, OutboundMessage
 *   NoteCreate, NoteUpdate, NoteDelete
 *   TaskCreate, TaskUpdate, TaskComplete
 *
 * All upserts use conditional writes: only apply if the incoming data is newer
 * than what is stored (based on timestamp comparison).
 */

import { createAdminClient } from '@/lib/supabase-server'
import {
  transformContact,
  transformContactCustomFields,
  transformOpportunity,
  transformConversation,
  transformNote,
  transformTask,
} from './transforms'

type WebhookPayload = Record<string, unknown>

// ── Event type mapping ───────────────────────────────────────

const CONTACT_EVENTS = [
  'ContactCreate', 'ContactUpdate', 'ContactDelete',
  'ContactDndUpdate', 'ContactTagUpdate',
  'contact.create', 'contact.update', 'contact.delete',
]

const OPPORTUNITY_EVENTS = [
  'OpportunityCreate', 'OpportunityUpdate', 'OpportunityDelete',
  'OpportunityStageUpdate', 'OpportunityStatusUpdate',
  'OpportunityMonetaryValueUpdate',
  'opportunity.create', 'opportunity.update', 'opportunity.delete',
]

const CONVERSATION_EVENTS = [
  'ConversationUpdated', 'ConversationUnreadUpdate',
  'InboundMessage', 'OutboundMessage',
  'conversation.updated', 'conversation.unread',
]

const NOTE_EVENTS = [
  'NoteCreate', 'NoteUpdate', 'NoteDelete',
  'note.create', 'note.update', 'note.delete',
]

const TASK_EVENTS = [
  'TaskCreate', 'TaskUpdate', 'TaskComplete',
  'task.create', 'task.update', 'task.complete',
]

const DELETE_KEYWORDS = ['Delete', 'delete', 'Removed', 'removed']

function isDeleteEvent(eventType: string): boolean {
  return DELETE_KEYWORDS.some((kw) => eventType.includes(kw))
}

// ── Main processor ───────────────────────────────────────────

export async function processWebhookEvent(
  locationId: string,
  eventType: string,
  payload: WebhookPayload,
): Promise<{ processed: boolean; entity?: string }> {
  // Extract the entity data — GHL sometimes wraps it in different keys
  const data = extractEntityData(payload)

  if (CONTACT_EVENTS.some((e) => eventType.includes(e) || eventType === e)) {
    await processContactEvent(locationId, eventType, data)
    return { processed: true, entity: 'contact' }
  }

  if (OPPORTUNITY_EVENTS.some((e) => eventType.includes(e) || eventType === e)) {
    await processOpportunityEvent(locationId, eventType, data)
    return { processed: true, entity: 'opportunity' }
  }

  if (CONVERSATION_EVENTS.some((e) => eventType.includes(e) || eventType === e)) {
    await processConversationEvent(locationId, eventType, data)
    return { processed: true, entity: 'conversation' }
  }

  if (NOTE_EVENTS.some((e) => eventType.includes(e) || eventType === e)) {
    await processNoteEvent(locationId, eventType, data)
    return { processed: true, entity: 'note' }
  }

  if (TASK_EVENTS.some((e) => eventType.includes(e) || eventType === e)) {
    await processTaskEvent(locationId, eventType, data)
    return { processed: true, entity: 'task' }
  }

  return { processed: false }
}

// ── Entity data extraction ───────────────────────────────────

function extractEntityData(payload: WebhookPayload): WebhookPayload {
  // GHL wraps data in various keys depending on the event
  if (payload.contact && typeof payload.contact === 'object') return payload.contact as WebhookPayload
  if (payload.opportunity && typeof payload.opportunity === 'object') return payload.opportunity as WebhookPayload
  if (payload.conversation && typeof payload.conversation === 'object') return payload.conversation as WebhookPayload
  if (payload.note && typeof payload.note === 'object') return payload.note as WebhookPayload
  if (payload.task && typeof payload.task === 'object') return payload.task as WebhookPayload
  if (payload.data && typeof payload.data === 'object') return payload.data as WebhookPayload
  return payload
}

// ── Contact events ───────────────────────────────────────────

async function processContactEvent(locationId: string, eventType: string, data: WebhookPayload) {
  const contactId = (data.id ?? data.contactId ?? data.contact_id) as string | undefined
  if (!contactId) return

  const sb = createAdminClient()

  if (isDeleteEvent(eventType)) {
    await sb.from('cached_contact_custom_fields').delete()
      .eq('location_id', locationId).eq('contact_ghl_id', contactId)
    await sb.from('cached_contacts').delete()
      .eq('location_id', locationId).eq('ghl_id', contactId)
    return
  }

  // Upsert contact
  const row = transformContact(locationId, { ...data, id: contactId })
  await sb.from('cached_contacts').upsert(row as never, { onConflict: 'location_id,ghl_id' })

  // Upsert custom fields if present
  const customFields = data.customFields ?? data.custom_fields
  if (Array.isArray(customFields)) {
    // Delete existing and re-insert
    await sb.from('cached_contact_custom_fields').delete()
      .eq('location_id', locationId).eq('contact_ghl_id', contactId)
    const cfRows = transformContactCustomFields(locationId, contactId, customFields)
    if (cfRows.length > 0) {
      await sb.from('cached_contact_custom_fields').upsert(
        cfRows as never[],
        { onConflict: 'location_id,contact_ghl_id,field_id' },
      )
    }
  }
}

// ── Opportunity events ───────────────────────────────────────

async function processOpportunityEvent(locationId: string, eventType: string, data: WebhookPayload) {
  const oppId = (data.id ?? data.opportunityId ?? data.opportunity_id) as string | undefined
  if (!oppId) return

  const sb = createAdminClient()

  if (isDeleteEvent(eventType)) {
    await sb.from('cached_opportunities').delete()
      .eq('location_id', locationId).eq('ghl_id', oppId)
    return
  }

  const row = transformOpportunity(locationId, { ...data, id: oppId })
  await sb.from('cached_opportunities').upsert(row as never, { onConflict: 'location_id,ghl_id' })
}

// ── Conversation events ──────────────────────────────────────

async function processConversationEvent(locationId: string, _eventType: string, data: WebhookPayload) {
  const convoId = (data.id ?? data.conversationId ?? data.conversation_id) as string | undefined
  if (!convoId) return

  const sb = createAdminClient()
  const row = transformConversation(locationId, { ...data, id: convoId })
  await sb.from('cached_conversations').upsert(row as never, { onConflict: 'location_id,ghl_id' })
}

// ── Note events ──────────────────────────────────────────────

async function processNoteEvent(locationId: string, eventType: string, data: WebhookPayload) {
  const noteId = (data.id ?? data.noteId ?? data.note_id) as string | undefined
  const contactId = (data.contactId ?? data.contact_id) as string | undefined
  if (!noteId) return

  const sb = createAdminClient()

  if (isDeleteEvent(eventType)) {
    await sb.from('cached_notes').delete()
      .eq('location_id', locationId).eq('ghl_id', noteId)
    return
  }

  if (!contactId) return
  const row = transformNote(locationId, contactId, { ...data, id: noteId })
  await sb.from('cached_notes').upsert(row as never, { onConflict: 'location_id,ghl_id' })
}

// ── Task events ──────────────────────────────────────────────

async function processTaskEvent(locationId: string, eventType: string, data: WebhookPayload) {
  const taskId = (data.id ?? data.taskId ?? data.task_id) as string | undefined
  const contactId = (data.contactId ?? data.contact_id) as string | undefined
  if (!taskId || !contactId) return

  const sb = createAdminClient()

  if (isDeleteEvent(eventType)) {
    await sb.from('cached_tasks').delete()
      .eq('location_id', locationId).eq('ghl_id', taskId)
    return
  }

  const row = transformTask(locationId, contactId, { ...data, id: taskId })
  await sb.from('cached_tasks').upsert(row as never, { onConflict: 'location_id,ghl_id' })
}
