'use server'

import { redirect } from 'next/navigation'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import { assertUserOwnsLocation } from '@/lib/location/getActiveLocation'
import { trackEvent } from '@/lib/analytics'

export async function createAppointment(data: {
  title?: string
  startTime: string
  endTime: string
  calendarId: string
  contactId?: string
}, locationId: string): Promise<{ error: string } | undefined> {
  try {
    await assertUserOwnsLocation(locationId)
    const ghl = await getGhlClient(locationId)
    await ghl.calendarEvents.create({
      title: data.title?.trim(),
      startTime: new Date(data.startTime).toISOString(),
      endTime: new Date(data.endTime).toISOString(),
      calendarId: data.calendarId,
      contactId: data.contactId,
    })
    await trackEvent(locationId, 'appointment_created')
  } catch (err) {
    console.error('Create appointment failed:', err)
    return { error: err instanceof Error ? err.message : 'Failed to create appointment' }
  }

  redirect(`/designs/apulia-power/calendar?locationId=${locationId}`)
}
