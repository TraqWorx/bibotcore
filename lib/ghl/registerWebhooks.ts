/**
 * Register GHL webhooks for a sub-account location.
 *
 * GHL requires webhooks to be registered per sub-account via
 * POST /hooks/ with a list of event types.
 *
 * This should be called:
 * - During provisionLocation() for new locations
 * - From admin UI to register webhooks for existing locations
 */

import { getGhlTokenForLocation } from './getGhlTokenForLocation'

const GHL_BASE = 'https://services.leadconnectorhq.com'

/**
 * All CRM entity events we want to receive.
 * See: https://marketplace.gohighlevel.com/docs/webhooks/events
 */
const WEBHOOK_EVENTS = [
  // Contacts
  'ContactCreate',
  'ContactUpdate',
  'ContactDelete',
  'ContactDndUpdate',
  'ContactTagUpdate',
  // Opportunities
  'OpportunityCreate',
  'OpportunityUpdate',
  'OpportunityDelete',
  'OpportunityStageUpdate',
  'OpportunityStatusUpdate',
  'OpportunityMonetaryValueUpdate',
  // Conversations
  'ConversationUpdated',
  'ConversationUnreadUpdate',
  'InboundMessage',
  'OutboundMessage',
  // Notes
  'NoteCreate',
  'NoteUpdate',
  'NoteDelete',
  // Tasks
  'TaskCreate',
  'TaskUpdate',
  'TaskComplete',
  // Appointments
  'AppointmentCreate',
  'AppointmentUpdate',
  'AppointmentDelete',
]

function getWebhookUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    ?? 'http://localhost:3000'
  return `${baseUrl}/api/webhooks/ghl`
}

/**
 * Register all CRM entity webhooks for a location.
 * Returns the created webhook ID or null on failure.
 */
export async function registerWebhooks(
  locationId: string,
): Promise<{ id: string; events: string[] } | null> {
  const token = await getGhlTokenForLocation(locationId)
  const url = getWebhookUrl()

  const res = await fetch(`${GHL_BASE}/hooks/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      events: WEBHOOK_EVENTS,
      locationId,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[registerWebhooks] Failed for ${locationId}: ${res.status} ${text}`)
    return null
  }

  const data = await res.json()
  console.log(`[registerWebhooks] Registered ${WEBHOOK_EVENTS.length} events for ${locationId}`)
  return {
    id: data?.id ?? data?.hook?.id ?? 'unknown',
    events: WEBHOOK_EVENTS,
  }
}

/**
 * List existing webhooks for a location.
 */
export async function listWebhooks(locationId: string): Promise<unknown[]> {
  const token = await getGhlTokenForLocation(locationId)

  const res = await fetch(`${GHL_BASE}/hooks/?locationId=${locationId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: '2021-07-28',
    },
  })

  if (!res.ok) return []
  const data = await res.json()
  return data?.hooks ?? data ?? []
}

/**
 * Delete a webhook by ID.
 */
export async function deleteWebhook(locationId: string, hookId: string): Promise<boolean> {
  const token = await getGhlTokenForLocation(locationId)

  const res = await fetch(`${GHL_BASE}/hooks/${hookId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      Version: '2021-07-28',
    },
  })

  return res.ok
}
