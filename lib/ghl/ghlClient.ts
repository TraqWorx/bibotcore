import { getGhlTokenForLocation } from './getGhlTokenForLocation'

const BASE_URL = 'https://services.leadconnectorhq.com'

export interface GhlContact {
  id: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
}

export interface GhlPipeline {
  id: string
  name: string
  stages: { id: string; name: string }[]
}

export interface GhlCalendar {
  id: string
  name: string
}

/**
 * Returns a GHL API client scoped to a specific locationId.
 * The caller is responsible for validating that the user owns this location
 * (via getActiveLocation or assertUserOwnsLocation).
 */
export async function getGhlClient(locationId: string) {
  const accessToken = await getGhlTokenForLocation(locationId)

  async function request(path: string, options: RequestInit = {}, version = '2021-07-28') {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Version: version,
        ...(options.headers ?? {}),
      },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`GHL API error: ${text}`)
    }

    return res.json()
  }

  return {
    locationId,
    contacts: {
      list: () => request(`/contacts/?locationId=${locationId}`),
      get: (contactId: string) => request(`/contacts/${contactId}`),
      create: (data: Record<string, unknown>) =>
        request('/contacts/', {
          method: 'POST',
          body: JSON.stringify({ ...data, locationId }),
          headers: { 'Content-Type': 'application/json' },
        }),
      update: (contactId: string, data: Record<string, unknown>) =>
        request(`/contacts/${contactId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
          headers: { 'Content-Type': 'application/json' },
        }),
      delete: (contactId: string) =>
        request(`/contacts/${contactId}`, { method: 'DELETE' }),
    },
    customFields: {
      list: () => request(`/locations/${locationId}/customFields`, {}, '2021-07-28'),
      create: (data: { name: string; dataType: string; placeholder?: string; position?: number; model?: string; parentId?: string; options?: string[] }) =>
        request(`/locations/${locationId}/customFields`, {
          method: 'POST',
          body: JSON.stringify(data),
          headers: { 'Content-Type': 'application/json' },
        }, '2021-07-28'),
      delete: (fieldId: string) =>
        request(`/locations/${locationId}/customFields/${fieldId}`, { method: 'DELETE' }, '2021-07-28'),
    },
    opportunities: {
      list: () => request(`/opportunities/search?location_id=${locationId}`),
      byContact: async (contactId: string) => {
        const data = await request(`/opportunities/search?location_id=${locationId}`)
        const all: {
          id: string
          name?: string
          pipelineStageId?: string
          monetaryValue?: number
          contactId?: string
        }[] = data?.opportunities ?? []
        return { opportunities: all.filter((opp) => opp.contactId === contactId) }
      },
      create: (data: {
        name: string
        pipelineId: string
        pipelineStageId: string
        contactId?: string
        monetaryValue?: number
        status?: string
      }) =>
        request('/opportunities/', {
          method: 'POST',
          body: JSON.stringify({ ...data, status: data.status ?? 'open', locationId }),
          headers: { 'Content-Type': 'application/json' },
        }),
      get: (id: string) => request(`/opportunities/${id}`),
      updateStage: (opportunityId: string, pipelineStageId: string) =>
        request(`/opportunities/${opportunityId}`, {
          method: 'PUT',
          body: JSON.stringify({ pipelineStageId }),
          headers: { 'Content-Type': 'application/json' },
        }),
      update: (
        opportunityId: string,
        data: { name?: string; monetaryValue?: number; pipelineStageId?: string; status?: string }
      ) =>
        request(`/opportunities/${opportunityId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
          headers: { 'Content-Type': 'application/json' },
        }),
      delete: (opportunityId: string) =>
        request(`/opportunities/${opportunityId}`, { method: 'DELETE' }),
    },
    pipelines: {
      list: () => request(`/opportunities/pipelines?locationId=${locationId}`),
      create: (data: { name: string; stages: { name: string }[] }) =>
        request('/opportunities/pipelines', {
          method: 'POST',
          body: JSON.stringify({ ...data, locationId }),
          headers: { 'Content-Type': 'application/json' },
        }),
    },
    conversations: {
      search: (query?: string) =>
        request(`/conversations/search?locationId=${locationId}${query ? `&${query}` : ''}`, undefined, '2021-04-15'),
      byContact: (contactId: string) =>
        request(`/conversations/search?contactId=${contactId}`, undefined, '2021-04-15'),
      get: (conversationId: string) =>
        request(`/conversations/${conversationId}`, undefined, '2021-04-15'),
      messages: (conversationId: string) =>
        request(`/conversations/${conversationId}/messages?limit=50`),
      messages_raw: (path: string) => request(path),
      send: (conversationId: string, body: string, options?: { type?: string; contactId?: string }) =>
        request('/conversations/messages', {
          method: 'POST',
          body: JSON.stringify({
            type: options?.type ?? 'SMS',
            contactId: options?.contactId,
            conversationId,
            message: body,
          }),
          headers: { 'Content-Type': 'application/json' },
        }, '2021-04-15'),
    },
    notes: {
      list: (contactId: string) => request(`/contacts/${contactId}/notes`),
      create: (contactId: string, body: string) =>
        request(`/contacts/${contactId}/notes`, {
          method: 'POST',
          body: JSON.stringify({ body }),
          headers: { 'Content-Type': 'application/json' },
        }),
      delete: (contactId: string, noteId: string) =>
        request(`/contacts/${contactId}/notes/${noteId}`, { method: 'DELETE' }),
      update: (contactId: string, noteId: string, body: string) =>
        request(`/contacts/${contactId}/notes/${noteId}`, {
          method: 'PUT',
          body: JSON.stringify({ body }),
          headers: { 'Content-Type': 'application/json' },
        }),
    },
    tasks: {
      list: (contactId: string) => request(`/contacts/${contactId}/tasks`),
      create: (contactId: string, title: string, dueDate?: string) =>
        request(`/contacts/${contactId}/tasks`, {
          method: 'POST',
          body: JSON.stringify({
            title,
            dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            completed: false,
          }),
          headers: { 'Content-Type': 'application/json' },
        }),
      complete: (contactId: string, taskId: string) =>
        request(`/contacts/${contactId}/tasks/${taskId}`, {
          method: 'PUT',
          body: JSON.stringify({ completed: true }),
          headers: { 'Content-Type': 'application/json' },
        }),
    },
    tags: {
      list: () => request(`/locations/${locationId}/tags`),
      create: (tag: string) =>
        request(`/locations/${locationId}/tags`, {
          method: 'POST',
          body: JSON.stringify({ name: tag }),
          headers: { 'Content-Type': 'application/json' },
        }),
      delete: (tagId: string) =>
        request(`/locations/${locationId}/tags/${tagId}`, { method: 'DELETE' }),
    },
    invoices: {
      list: (params?: string) =>
        request(`/invoices/search${params ? `?${params}` : `?locationId=${locationId}&limit=100`}`, {
          method: 'POST',
          body: JSON.stringify({ locationId }),
          headers: { 'Content-Type': 'application/json' },
        }),
    },
    calendars: {
      list: () => request(`/calendars/?locationId=${locationId}`, {}, '2021-04-15'),
    },
    calendarEvents: {
      async list() {
        const now = Date.now()
        const startTime = now - 30 * 24 * 60 * 60 * 1000
        const endTime = now + 30 * 24 * 60 * 60 * 1000

        const calendarsData = await request(`/calendars/?locationId=${locationId}`, {}, '2021-04-15')
        const calendars: GhlCalendar[] = calendarsData?.calendars ?? []

        const eventArrays = await Promise.all(
          calendars.map((cal) =>
            request(
              `/calendars/events?locationId=${locationId}&calendarId=${cal.id}&startTime=${startTime}&endTime=${endTime}`,
              {},
              '2021-04-15'
            )
              .then((d: { events?: unknown[] }) => d?.events ?? [])
              .catch(() => [])
          )
        )

        return { events: eventArrays.flat() }
      },
      async byContact(contactId: string) {
        const now = Date.now()
        const startTime = now - 365 * 24 * 60 * 60 * 1000
        const endTime = now + 365 * 24 * 60 * 60 * 1000

        const calendarsData = await request(`/calendars/?locationId=${locationId}`, {}, '2021-04-15')
        const calendars: GhlCalendar[] = calendarsData?.calendars ?? []

        const eventArrays = await Promise.all(
          calendars.map((cal) =>
            request(
              `/calendars/events?locationId=${locationId}&calendarId=${cal.id}&startTime=${startTime}&endTime=${endTime}`,
              {},
              '2021-04-15'
            )
              .then((d: {
                events?: {
                  id: string
                  title?: string
                  calendarId?: string
                  startTime?: string
                  appointmentStatus?: string
                  contactId?: string
                }[]
              }) => (d?.events ?? []).filter((e) => e.contactId === contactId))
              .catch(() => [])
          )
        )

        return { events: eventArrays.flat() }
      },
      create: (data: {
        title?: string
        startTime: string
        endTime: string
        calendarId: string
        contactId?: string
      }) =>
        request(
          `/calendars/events/appointments?locationId=${locationId}`,
          {
            method: 'POST',
            body: JSON.stringify({ ...data, locationId }),
            headers: { 'Content-Type': 'application/json' },
          },
          '2021-04-15'
        ),
    },
  }
}
