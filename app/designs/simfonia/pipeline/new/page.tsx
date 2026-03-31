import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { createAdminClient } from '@/lib/supabase-server'
import { listPipelines } from '@/lib/data/pipelines'
import NewOpportunityForm from './_components/NewOpportunityForm'

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const locationId = await getActiveLocation(sp)
  const sb = createAdminClient()

  const [{ pipelines: cachedPipelines }, { data: cachedContacts }] = await Promise.all([
    listPipelines(locationId),
    sb.from('cached_contacts')
      .select('ghl_id, first_name, last_name')
      .eq('location_id', locationId)
      .order('first_name'),
  ])

  const pipelines = cachedPipelines.map((p) => ({
    id: p.ghl_id,
    name: p.name ?? '',
    stages: p.stages ?? [],
  }))

  const contacts = (cachedContacts ?? []).map((c) => ({
    id: c.ghl_id,
    name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.ghl_id,
  }))

  const preselectedPipelineId = typeof sp.pipelineId === 'string' ? sp.pipelineId : undefined
  const preselectedStageId = typeof sp.stageId === 'string' ? sp.stageId : undefined

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Nuova Opportunità</h1>
      <NewOpportunityForm
        pipelines={pipelines}
        contacts={contacts}
        locationId={locationId}
        preselectedPipelineId={preselectedPipelineId}
        preselectedStageId={preselectedStageId}
      />
    </div>
  )
}
