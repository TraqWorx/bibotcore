'use server'

import { redirect } from 'next/navigation'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import { assertUserOwnsLocation } from '@/lib/location/getActiveLocation'
import { trackEvent } from '@/lib/analytics'

export async function createOpportunity(data: {
  name: string
  pipelineId: string
  pipelineStageId: string
  contactId?: string
  monetaryValue?: number
}, locationId: string): Promise<{ error: string } | undefined> {
  try {
    await assertUserOwnsLocation(locationId)
    const ghl = await getGhlClient(locationId)
    await ghl.opportunities.create({
      name: data.name.trim(),
      pipelineId: data.pipelineId,
      pipelineStageId: data.pipelineStageId,
      ...(data.contactId ? { contactId: data.contactId } : {}),
      monetaryValue: data.monetaryValue ?? 0,
    })
    await trackEvent(locationId, 'opportunity_created')
  } catch (err) {
    console.error('Create opportunity failed:', err)
    return { error: err instanceof Error ? err.message : 'Failed to create opportunity' }
  }

  redirect('/designs/apulia-power/pipeline')
}
