import { createAdminClient } from '@/lib/supabase-server'

export type ActivityType =
  | 'deal.created'
  | 'deal.stage_changed'
  | 'contact.created'
  | 'appointment.created'
  | 'message.sent'
  | 'message.received'

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
}
