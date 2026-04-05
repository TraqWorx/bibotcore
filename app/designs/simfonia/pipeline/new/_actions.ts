'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import { assertUserOwnsLocation } from '@/lib/location/getActiveLocation'
import { trackEvent } from '@/lib/analytics'
import { translateGhlError } from '@/lib/utils/ghlErrors'
import { writeThroughOpportunity } from '@/lib/sync/writeThrough'

export async function createOpportunity(data: {
  name: string
  pipelineId: string
  pipelineStageId: string
  contactId?: string
  monetaryValue?: number
}, locationId: string): Promise<{ error?: string } | undefined> {
  try {
    await assertUserOwnsLocation(locationId)
    const ghl = await getGhlClient(locationId)
    const result = await ghl.opportunities.create({
      name: data.name.trim(),
      pipelineId: data.pipelineId,
      pipelineStageId: data.pipelineStageId,
      ...(data.contactId ? { contactId: data.contactId } : {}),
      monetaryValue: data.monetaryValue ?? 0,
    })
    const opp = result?.opportunity ?? result
    if (opp?.id) {
      await writeThroughOpportunity(ghl.locationId, {
        ...data,
        ...opp as Record<string, unknown>,
        id: (opp as Record<string, unknown>).id ?? (opp as Record<string, unknown>).opportunityId,
        pipelineId: (opp as Record<string, unknown>).pipelineId ?? data.pipelineId,
        pipelineStageId: (opp as Record<string, unknown>).pipelineStageId ?? data.pipelineStageId,
        contactId: (opp as Record<string, unknown>).contactId ?? data.contactId,
        monetaryValue: (opp as Record<string, unknown>).monetaryValue ?? data.monetaryValue ?? 0,
        status: (opp as Record<string, unknown>).status ?? 'open',
      })
    }
    await trackEvent(locationId, 'opportunity_created')
    revalidatePath('/designs/simfonia/pipeline')
  } catch (err) {
    console.error('Create opportunity failed:', err)
    return { error: translateGhlError(err, 'Errore nella creazione dell\'opportunità') }
  }

  redirect(`/designs/simfonia/pipeline?locationId=${locationId}&created=${Date.now()}`)
}
