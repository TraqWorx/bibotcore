import { createAdminClient } from '@/lib/supabase-server'

export async function createNotification(
  userId: string,
  locationId: string,
  type: string,
  title: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('notifications').insert({
    user_id: userId,
    location_id: locationId,
    type,
    title,
    metadata,
  })
}
