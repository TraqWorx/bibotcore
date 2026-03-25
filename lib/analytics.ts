import { createAdminClient } from '@/lib/supabase-server'

export type AnalyticsEvent =
  | 'contact_created'
  | 'opportunity_created'
  | 'appointment_created'

export async function trackEvent(locationId: string, eventType: AnalyticsEvent) {
  try {
    const supabase = createAdminClient()
    await supabase
      .from('usage_metrics')
      .insert({ location_id: locationId, event_type: eventType })
  } catch (err) {
    // Analytics must never break the main flow
    console.error('trackEvent failed:', err)
  }
}
