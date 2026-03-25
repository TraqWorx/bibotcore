import { createAdminClient } from '@/lib/supabase-server'
import { createNotification } from '@/lib/notifications/createNotification'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'

const GHL_BASE = 'https://services.leadconnectorhq.com'

export type AutomationTrigger =
  | 'contact_created'
  | 'deal_created'
  | 'deal_stage_changed'
  | 'appointment_created'
  | 'message_received'

interface Condition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains'
  value: string
}

interface Action {
  type: 'send_internal_notification' | 'create_task' | 'send_sms' | 'add_contact_tag'
  config: Record<string, string | number>
}

interface Automation {
  id: string
  name: string
  conditions: Condition[]
  actions: Action[]
}

function evaluateConditions(
  conditions: Condition[],
  context: Record<string, unknown>
): boolean {
  if (!conditions || conditions.length === 0) return true
  return conditions.every((cond) => {
    const val = String(context[cond.field] ?? '').toLowerCase()
    const cmp = String(cond.value ?? '').toLowerCase()
    switch (cond.operator) {
      case 'equals':      return val === cmp
      case 'not_equals':  return val !== cmp
      case 'contains':    return val.includes(cmp)
      case 'not_contains': return !val.includes(cmp)
      default:            return true
    }
  })
}

async function ghlFetch(token: string, path: string, options: RequestInit = {}) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: '2021-07-28',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GHL ${path} error: ${text}`)
  }
  return res.json()
}

async function executeAction(
  action: Action,
  context: Record<string, unknown>,
  locationId: string,
  userId: string | undefined,
  automationName: string
): Promise<void> {
  switch (action.type) {
    case 'send_internal_notification': {
      if (!userId) break
      const title = String(action.config.title || `Automation triggered: ${automationName}`)
      await createNotification(userId, locationId, 'automation', title, context)
      break
    }

    case 'create_task': {
      const contactId = context.contactId as string | undefined
      if (!contactId) break
      const token = await getGhlTokenForLocation(locationId)
      const dueHours = Number(action.config.dueHours || 24)
      const dueDate = new Date(Date.now() + dueHours * 3600 * 1000).toISOString()
      await ghlFetch(token, `/contacts/${contactId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title: String(action.config.title || 'Follow-up task'),
          dueDate,
          status: 'incompleted',
        }),
        headers: { 'Content-Type': 'application/json' },
      }).catch(console.error)
      break
    }

    case 'send_sms': {
      const contactId = context.contactId as string | undefined
      if (!contactId) break
      const token = await getGhlTokenForLocation(locationId)
      const convData = await ghlFetch(
        token,
        `/conversations/search?contactId=${contactId}`
      ).catch(() => null)
      const conversationId: string | undefined = convData?.conversations?.[0]?.id
      if (!conversationId) break
      await ghlFetch(token, '/conversations/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversationId,
          body: String(action.config.message || ''),
          type: 'SMS',
        }),
        headers: { 'Content-Type': 'application/json' },
      }).catch(console.error)
      break
    }

    case 'add_contact_tag': {
      const contactId = context.contactId as string | undefined
      if (!contactId) break
      const tag = String(action.config.tag || '')
      if (!tag) break
      const token = await getGhlTokenForLocation(locationId)
      await ghlFetch(token, `/contacts/${contactId}/tags`, {
        method: 'POST',
        body: JSON.stringify({ tags: [tag] }),
        headers: { 'Content-Type': 'application/json' },
      }).catch(console.error)
      break
    }
  }
}

/**
 * Run all active automations for a location matching the given trigger.
 * Called fire-and-forget from the GHL webhook route or logActivity.
 *
 * @param webhookEventId  Optional FK to ghl_webhook_events for audit logging
 */
export async function runAutomations(
  locationId: string,
  triggerType: string,
  context: Record<string, unknown>,
  webhookEventId?: string
): Promise<void> {
  const supabase = createAdminClient()

  // Fetch matching active automations
  const { data: automations } = await supabase
    .from('automations')
    .select('id, name, conditions, actions')
    .eq('location_id', locationId)
    .eq('trigger_type', triggerType)
    .eq('active', true)

  if (!automations || automations.length === 0) {
    // Mark event processed even if no automations matched
    if (webhookEventId) {
      await supabase
        .from('ghl_webhook_events')
        .update({ processed: true })
        .eq('id', webhookEventId)
    }
    return
  }

  // Resolve owner user ID from installs (best-effort, needed for notifications)
  const { data: install } = await supabase
    .from('installs')
    .select('user_id')
    .eq('location_id', locationId)
    .limit(1)
    .single()
  const userId = install?.user_id ?? undefined

  for (const automation of automations as Automation[]) {
    const conditions: Condition[] = Array.isArray(automation.conditions)
      ? automation.conditions
      : []

    // Insert execution record
    const { data: execution } = await supabase
      .from('automation_executions')
      .insert({
        automation_id: automation.id,
        location_id: locationId,
        event_type: triggerType,
        ...(webhookEventId ? { webhook_event_id: webhookEventId } : {}),
        status: 'running',
      })
      .select('id')
      .single()

    if (!evaluateConditions(conditions, context)) {
      await supabase
        .from('automation_executions')
        .update({ status: 'completed' })
        .eq('id', execution?.id)
      continue
    }

    const actions: Action[] = Array.isArray(automation.actions) ? automation.actions : []
    let error: string | undefined

    for (const action of actions) {
      try {
        await executeAction(action, context, locationId, userId, automation.name)
      } catch (err) {
        error = err instanceof Error ? err.message : String(err)
        console.error(`[runAutomations] Automation ${automation.id} action "${action.type}" failed:`, error)
        break
      }
    }

    await supabase
      .from('automation_executions')
      .update(error ? { status: 'failed', error } : { status: 'completed' })
      .eq('id', execution?.id)
  }

  // Mark webhook event as processed
  if (webhookEventId) {
    await supabase
      .from('ghl_webhook_events')
      .update({ processed: true })
      .eq('id', webhookEventId)
  }
}
