'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import { assertUserOwnsLocation } from '@/lib/location/getActiveLocation'
import { trackEvent } from '@/lib/analytics'

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
    revalidatePath('/designs/simfonia/contacts')
    revalidatePath('/designs/simfonia/dashboard')
  } catch (err) {
    console.error('Create contact failed:', err)
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('duplicated contacts') || msg.includes('duplicate')) {
      const match = msg.match(/"matchingField":"(\w+)"/)
      const field = match?.[1] ?? 'email'
      return { error: `Esiste già un contatto con lo stesso ${field}. Modifica il valore o aggiorna il contatto esistente.` }
    }
    return { error: msg || 'Errore nella creazione del contatto' }
  }

  redirect(`/designs/simfonia/contacts?locationId=${locationId}`)
}
