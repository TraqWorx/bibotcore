'use server'

import { getGhlClient } from '@/lib/ghl/ghlClient'
import { assertUserOwnsLocation } from '@/lib/location/getActiveLocation'
import { createAdminClient } from '@/lib/supabase-server'
import {
  writeThroughOpportunity,
  writeThroughOpportunityDelete,
  writeThroughNote,
  writeThroughNoteDelete,
  writeThroughTask,
} from '@/lib/sync/writeThrough'

export async function moveOpportunity(
  opportunityId: string,
  stageId: string,
  locationId: string,
): Promise<{ error: string } | undefined> {
  try {
    await assertUserOwnsLocation(locationId)
    const ghl = await getGhlClient(locationId)
    await ghl.opportunities.updateStage(opportunityId, stageId)
    await writeThroughOpportunity(locationId, { id: opportunityId, pipelineStageId: stageId })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to move opportunity' }
  }
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
    await writeThroughOpportunity(locationId, { id: opportunityId, ...data })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update' }
  }
}

export async function getDealData(dealId: string, locationId: string) {
  await assertUserOwnsLocation(locationId)
  const supabase = createAdminClient()

  try {
    // Get opportunity from cache
    let opportunity: Record<string, unknown> | null = null
    const { data: cachedOpp } = await supabase
      .from('cached_opportunities')
      .select('ghl_id, name, pipeline_id, pipeline_stage_id, contact_ghl_id, monetary_value, status, created_at')
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
        createdAt: cachedOpp.created_at,
      }
    } else {
      // Fallback to GHL
      try {
        const ghl = await getGhlClient(locationId)
        const oppData = await ghl.opportunities.get(dealId)
        opportunity = oppData?.opportunity ?? null
      } catch { /* ignore */ }
    }

    let contact = null
    let conversation = null
    let messages: { id: string; body?: string; direction?: string; dateAdded?: string }[] = []
    let notes: { id: string; body?: string; dateAdded?: string; createdBy?: string }[] = []
    let tasks: { id: string; title?: string; dueDate?: string; status?: string; completed?: boolean }[] = []
    let appointments: { id: string; title?: string; startTime?: string; appointmentStatus?: string }[] = []
    let users: { id: string; name: string }[] = []

    const contactId = (opportunity as Record<string, unknown>)?.contactId as string | undefined

    if (contactId) {
      // Fetch ALL from cache in parallel
      const [
        cachedContact,
        cachedConvo,
        cachedNotes,
        cachedTasks,
        cachedEvents,
        cachedUsers,
        noteAuthors,
      ] = await Promise.all([
        supabase.from('cached_contacts').select('ghl_id, first_name, last_name, email, phone, company_name, tags, raw').eq('location_id', locationId).eq('ghl_id', contactId).maybeSingle(),
        supabase.from('cached_conversations').select('ghl_id, type').eq('location_id', locationId).eq('contact_ghl_id', contactId).limit(1).maybeSingle(),
        supabase.from('cached_notes').select('ghl_id, body, date_added, created_by').eq('location_id', locationId).eq('contact_ghl_id', contactId).order('date_added', { ascending: false }).limit(50),
        supabase.from('cached_tasks').select('ghl_id, title, due_date, completed').eq('location_id', locationId).eq('contact_ghl_id', contactId).limit(50),
        supabase.from('cached_calendar_events').select('ghl_id, title, start_time, appointment_status').eq('location_id', locationId).eq('contact_ghl_id', contactId).order('start_time', { ascending: false }),
        supabase.from('cached_ghl_users').select('ghl_id, name, first_name, last_name, email').eq('location_id', locationId),
        supabase.from('note_authors').select('note_id, author_user_id').eq('location_id', locationId).eq('contact_id', contactId).limit(50),
      ])

      // Contact
      if (cachedContact.data) {
        const c = cachedContact.data
        contact = c.raw ?? {
          id: c.ghl_id, firstName: c.first_name, lastName: c.last_name,
          email: c.email, phone: c.phone, companyName: c.company_name,
          tags: c.tags, customFields: [],
        }
      }

      // Conversation + messages
      const convoId = cachedConvo.data?.ghl_id
      if (convoId) {
        conversation = { id: convoId, type: cachedConvo.data?.type }
        // Try GHL for real-time messages, fall back to cached
        try {
          const ghl = await getGhlClient(locationId)
          const msgData = await ghl.conversations.messages(convoId)
          const nested = msgData?.messages
          const rawMsgs = Array.isArray(nested) ? nested : nested?.messages ?? []
          messages = Array.isArray(rawMsgs) ? rawMsgs : []
        } catch {
          const { data: cachedMsgs } = await supabase.from('cached_messages')
            .select('ghl_id, body, direction, date_added')
            .eq('location_id', locationId).eq('conversation_id', convoId)
            .order('date_added', { ascending: true })
            .limit(100)
          messages = (cachedMsgs ?? []).map((m) => ({
            id: m.ghl_id, body: m.body ?? '', direction: m.direction ?? '', dateAdded: m.date_added ?? '',
          }))
        }
      } else {
        // No cached conversation — try GHL
        try {
          const ghl = await getGhlClient(locationId)
          const convData = await ghl.conversations.byContact(contactId)
          const conv = convData?.conversations?.[0]
          if (conv?.id) {
            conversation = { id: conv.id, type: conv.type }
            const msgData = await ghl.conversations.messages(conv.id)
            const nested = msgData?.messages
            const rawMsgs = Array.isArray(nested) ? nested : nested?.messages ?? []
            messages = Array.isArray(rawMsgs) ? rawMsgs : []
          }
        } catch { /* GHL down */ }
      }

      // Notes with authors
      notes = (cachedNotes.data ?? []).map((n) => ({
        id: n.ghl_id, body: n.body ?? '', dateAdded: n.date_added ?? '', createdBy: n.created_by ?? '',
      }))
      // If no cached notes, try GHL
      if (notes.length === 0) {
        try {
          const ghl = await getGhlClient(locationId)
          const noteData = await ghl.notes.list(contactId)
          const raw = noteData?.notes ?? []
          notes = (Array.isArray(raw) ? raw : []).map((n: Record<string, unknown>) => ({
            id: String(n.id ?? ''), body: String(n.body ?? ''), dateAdded: String(n.dateAdded ?? ''), createdBy: String(n.userId ?? ''),
          }))
        } catch { /* ignore */ }
      }
      if (noteAuthors.data && notes.length > 0) {
        const authorMap = new Map(noteAuthors.data.map((a: { note_id: string; author_user_id: string }) => [a.note_id, a.author_user_id]))
        notes = notes.map((n) => ({ ...n, createdBy: authorMap.get(n.id) ?? n.createdBy ?? '' }))
      }

      // Tasks — if no cache, try GHL
      tasks = (cachedTasks.data ?? []).map((t) => ({
        id: t.ghl_id, title: t.title ?? '', dueDate: t.due_date ?? '', completed: t.completed ?? false,
      }))
      if (tasks.length === 0) {
        try {
          const ghl = await getGhlClient(locationId)
          const taskData = await ghl.tasks.list(contactId)
          const raw = taskData?.tasks ?? []
          tasks = (Array.isArray(raw) ? raw : []).map((t: Record<string, unknown>) => ({
            id: String(t.id ?? ''), title: String(t.title ?? ''), dueDate: String(t.dueDate ?? ''), completed: t.completed === true,
          }))
        } catch { /* ignore */ }
      }

      // Appointments
      appointments = (cachedEvents.data ?? []).map((e) => ({
        id: e.ghl_id, title: e.title ?? '', startTime: e.start_time ?? '', appointmentStatus: e.appointment_status ?? '',
      }))

      // Users
      users = (cachedUsers.data ?? []).map((u) => ({
        id: u.ghl_id,
        name: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.ghl_id,
      }))
    } else {
      // No contact — just get users
      const { data: cachedUsers } = await supabase.from('cached_ghl_users')
        .select('ghl_id, name, first_name, last_name, email').eq('location_id', locationId)
      users = (cachedUsers ?? []).map((u) => ({
        id: u.ghl_id,
        name: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.ghl_id,
      }))
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
    await writeThroughOpportunityDelete(locationId, opportunityId)
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
    if (note?.id) await writeThroughNote(locationId, contactId, note)
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
    await writeThroughNoteDelete(locationId, noteId)
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
    await writeThroughNote(locationId, contactId, { id: noteId, body })
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
    if (task?.id) await writeThroughTask(locationId, contactId, task)
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
