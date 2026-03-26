'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import { assertUserOwnsLocation } from '@/lib/location/getActiveLocation'
import { trackEvent } from '@/lib/analytics'

export async function createContact(data: {
  firstName: string
  lastName: string
  email: string
  phone: string
  tags?: string[]
  customFields?: { id: string; field_value: string }[]
}, locationId: string): Promise<{ error: string } | undefined> {
  try {
    await assertUserOwnsLocation(locationId)
    const ghl = await getGhlClient(locationId)
    await ghl.contacts.create({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
      ...(data.tags && data.tags.length > 0 ? { tags: data.tags } : {}),
      ...(data.customFields && data.customFields.length > 0 ? { customFields: data.customFields } : {}),
    })
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
