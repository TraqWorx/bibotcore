import { createAdminClient } from '@/lib/supabase-server'
import { runAutomations, type AutomationTrigger } from '@/lib/automations/runAutomations'

export type ActivityType =
  | 'deal.created'
  | 'deal.stage_changed'
  | 'contact.created'
  | 'appointment.created'
  | 'message.sent'
  | 'message.received'

const TRIGGER_MAP: Partial<Record<ActivityType, AutomationTrigger>> = {
  'contact.created':     'contact_created',
  'deal.created':        'deal_created',
  'deal.stage_changed':  'deal_stage_changed',
  'appointment.created': 'appointment_created',
  'message.received':    'message_received',
}

export async function logActivity(
  locationId: string,
  type: ActivityType,
  entityType: string,
  entityId: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('activity_feed').insert({
    location_id: locationId,
    type,
    entity_type: entityType,
    entity_id: entityId,
    data,
  })

  // Fire-and-forget: run matching automations
  const trigger = TRIGGER_MAP[type]
  if (trigger) {
    runAutomations(locationId, trigger, { ...data, entityId }).catch(
      (err) => console.error('runAutomations failed:', err)
    )
  }
}
