'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import { assertUserOwnsLocation } from '@/lib/location/getActiveLocation'
import { trackEvent } from '@/lib/analytics'
import { translateGhlError } from '@/lib/utils/ghlErrors'

export async function createContact(data: {
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  tags?: string[]
  customFields?: { id: string; field_value: string }[]
}, locationId: string): Promise<{ error: string } | undefined> {
  try {
    await assertUserOwnsLocation(locationId)
    const ghl = await getGhlClient(locationId)
    // Only send non-empty fields — GHL rejects empty strings for email/phone
    const payload: Record<string, unknown> = { firstName: data.firstName.trim() }
    if (data.lastName?.trim()) payload.lastName = data.lastName.trim()
    if (data.email?.trim()) payload.email = data.email.trim()
    if (data.phone?.trim()) payload.phone = data.phone.trim()
    if (data.tags && data.tags.length > 0) payload.tags = data.tags
    if (data.customFields && data.customFields.length > 0) payload.customFields = data.customFields
    await ghl.contacts.create(payload)
    await trackEvent(locationId, 'contact_created')
  } catch (err) {
    console.error('Create contact failed:', err)
    return { error: translateGhlError(err, 'Errore nella creazione del contatto') }
  }

  // Revalidate AFTER the try/catch so redirect (which throws) doesn't race with cache invalidation
  revalidatePath('/designs/simfonia/contacts', 'page')
  revalidatePath('/designs/simfonia/dashboard', 'page')
  redirect(`/designs/simfonia/contacts?locationId=${locationId}`)
}
