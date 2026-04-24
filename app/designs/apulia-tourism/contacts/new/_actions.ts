'use server'

import { revalidatePath } from 'next/cache'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import { assertUserOwnsLocation } from '@/lib/location/getActiveLocation'
import { trackEvent } from '@/lib/analytics'
import { translateGhlError } from '@/lib/utils/ghlErrors'
import { writeThroughContact } from '@/lib/sync/writeThrough'

export async function createContact(data: {
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  tags?: string[]
  customFields?: { id: string; field_value: string }[]
}, locationId: string): Promise<{ error: string } | { contactId: string }> {
  let contactId: string
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
    const response = await ghl.contacts.create(payload)
    const createdContact = (response as { contact: Record<string, unknown> }).contact
    contactId = createdContact.id as string
    // Write-through: add to cache immediately
    await writeThroughContact(ghl.locationId, createdContact)
    await trackEvent(locationId, 'contact_created')
  } catch (err) {
    console.error('Create contact failed:', err)
    return { error: translateGhlError(err, 'Errore nella creazione del contatto') }
  }

  revalidatePath('/designs/apulia-tourism/contacts', 'page')
  revalidatePath('/designs/apulia-tourism/dashboard', 'page')
  return { contactId }
}
