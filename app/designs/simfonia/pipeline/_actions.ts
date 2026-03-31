'use server'

import { getGhlClient } from '@/lib/ghl/ghlClient'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'
import { assertUserOwnsLocation } from '@/lib/location/getActiveLocation'
import { createAdminClient } from '@/lib/supabase-server'
import {
  writeThroughOpportunity,
  writeThroughOpportunityDelete,
  writeThroughNote,
  writeThroughNoteDelete,
  writeThroughTask,
} from '@/lib/sync/writeThrough'

const BASE_URL = 'https://services.leadconnectorhq.com'

export async function moveOpportunity(opportunityId: string, stageId: string, locationId: string) {
  await assertUserOwnsLocation(locationId)
  const ghl = await getGhlClient(locationId)
  await ghl.opportunities.updateStage(opportunityId, stageId)
  writeThroughOpportunity(locationId, { id: opportunityId, pipelineStageId: stageId })
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
    writeThroughOpportunity(locationId, { id: opportunityId, ...data })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update' }
  }
}

export async function getDealData(dealId: string, locationId: string) {
  await assertUserOwnsLocation(locationId)
  const ghl = await getGhlClient(locationId)
  const supabase = createAdminClient()

  try {
    // Get opportunity — try cache first, fall back to GHL
    let opportunity: Record<string, unknown> | null = null
    const { data: cachedOpp } = await supabase
      .from('cached_opportunities')
      .select('*')
      .eq('location_id', locationId)
      .eq('ghl_id', dealId)
      .single()

    if (cachedOpp) {
      opportunity = {
        id: cachedOpp.ghl_id,
        name: cachedOpp.name,
        pipelineId: cachedOpp.pipeline_id,
        pipelineStageId: cachedOpp.pipeline_stage_id,
        contactId: cachedOpp.contact_ghl_id,
        monetaryValue: cachedOpp.monetary_value,
        status: cachedOpp.status,
      }
    } else {
      const oppData = await ghl.opportunities.get(dealId)
      opportunity = oppData?.opportunity ?? null
    }

    let contact = null
    let conversation = null
    let messages: { id: string; body?: string; direction?: string; dateAdded?: string }[] = []
    let notes: { id: string; body?: string; dateAdded?: string; createdBy?: string }[] = []
    let tasks: { id: string; title?: string; dueDate?: string; status?: string; completed?: boolean }[] = []
    let appointments: { id: string; title?: string; startTime?: string; appointmentStatus?: string }[] = []
    let users: { id: string; name: string }[] = []

    // Fetch users in parallel (still from GHL — not cached)
    const usersPromise = (async () => {
      try {
        const token = await getGhlTokenForLocation(locationId)
        const res = await fetch(`${BASE_URL}/users/?locationId=${locationId}`, {
          headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
        })
        if (!res.ok) return []
        const data = await res.json()
        return ((data?.users ?? []) as { id: string; name?: string; firstName?: string; lastName?: string; email?: string }[]).map((u) => ({
          id: u.id,
          name: u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id),
        }))
      } catch { return [] }
    })()

    const contactId = (opportunity as Record<string, unknown>)?.contactId as string | undefined

    if (contactId) {
      // Fetch contact from cache, conversations/messages from GHL (messages aren't cached)
      const [cachedContact, convData, cachedNotes, cachedTasks, apptData, usersResult] = await Promise.allSettled([
        supabase.from('cached_contacts').select('*').eq('location_id', locationId).eq('ghl_id', contactId).single(),
        ghl.conversations.byContact(contactId),
        supabase.from('cached_notes').select('*').eq('location_id', locationId).eq('contact_ghl_id', contactId),
        supabase.from('cached_tasks').select('*').eq('location_id', locationId).eq('contact_ghl_id', contactId),
        ghl.calendarEvents.byContact(contactId),
        usersPromise,
      ])

      if (cachedContact.status === 'fulfilled' && cachedContact.value.data) {
        const c = cachedContact.value.data
        contact = c.raw ?? {
          id: c.ghl_id, firstName: c.first_name, lastName: c.last_name,
          email: c.email, phone: c.phone, companyName: c.company_name,
          tags: c.tags, customFields: [],
        }
      }

      if (convData.status === 'fulfilled') {
        conversation = convData.value?.conversations?.[0] ?? null
        if (conversation?.id) {
          try {
            const msgData = await ghl.conversations.messages(conversation.id)
            const nested = msgData?.messages
            const rawMsgs = Array.isArray(nested) ? nested : nested?.messages ?? []
            messages = Array.isArray(rawMsgs) ? rawMsgs : []
          } catch { /* ignore */ }
        }
      }

      if (cachedNotes.status === 'fulfilled') {
        const rows = cachedNotes.value.data ?? []
        notes = rows.map((n) => ({
          id: n.ghl_id, body: n.body ?? '', dateAdded: n.date_added ?? '', createdBy: n.created_by ?? '',
        }))
      }
      if (cachedTasks.status === 'fulfilled') {
        const rows = cachedTasks.value.data ?? []
        tasks = rows.map((t) => ({
          id: t.ghl_id, title: t.title ?? '', dueDate: t.due_date ?? '',
          completed: t.completed ?? false,
        }))
      }
      if (apptData.status === 'fulfilled') { const r = apptData.value?.events; appointments = Array.isArray(r) ? r : [] }
      if (usersResult.status === 'fulfilled') users = usersResult.value

      // Merge note authors from Supabase
      if (notes.length > 0) {
        try {
          const { data: authorData } = await supabase
            .from('note_authors')
            .select('note_id, author_user_id')
            .eq('location_id', locationId)
            .eq('contact_id', contactId)
          if (authorData) {
            const authorMap = new Map(authorData.map((a: { note_id: string; author_user_id: string }) => [a.note_id, a.author_user_id]))
            notes = notes.map((n) => ({
              ...n,
              createdBy: authorMap.get(n.id) ?? n.createdBy ?? '',
            }))
          }
        } catch { /* ignore */ }
      }
    } else {
      users = await usersPromise
    }

    return { opportunity, contact, conversation, messages, notes, tasks, appointments, users }
  } catch (err) {
    console.error('getDealData failed:', err)
    return {
      opportunity: null, contact: null, conversation: null,
      messages: [], notes: [], tasks: [], appointments: [], users: [],
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
    writeThroughOpportunityDelete(locationId, opportunityId)
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
    const result = await ghl.notes.create(contactId, body)
    const note = result?.note ?? result
    if (note?.id) writeThroughNote(locationId, contactId, note)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save note' }
  }
}

export async function deleteNote(
  contactId: string,
  noteId: string,
  locationId: string
): Promise<{ error: string } | undefined> {
  try {
    await assertUserOwnsLocation(locationId)
    const ghl = await getGhlClient(locationId)
    await ghl.notes.delete(contactId, noteId)
    writeThroughNoteDelete(locationId, noteId)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Errore eliminazione nota' }
  }
}

export async function updateNote(
  contactId: string,
  noteId: string,
  body: string,
  locationId: string
): Promise<{ error: string } | undefined> {
  try {
    await assertUserOwnsLocation(locationId)
    const ghl = await getGhlClient(locationId)
    await ghl.notes.update(contactId, noteId, body)
    writeThroughNote(locationId, contactId, { id: noteId, body })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Errore aggiornamento nota' }
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
    const result = await ghl.tasks.create(contactId, title, dueDate)
    const task = result?.task ?? result
    if (task?.id) writeThroughTask(locationId, contactId, task)
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
