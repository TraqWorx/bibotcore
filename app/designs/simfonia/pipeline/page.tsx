import Link from 'next/link'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { listPipelines } from '@/lib/data/pipelines'
import { listOpportunities } from '@/lib/data/opportunities'
import PipelineView from './PipelineView'

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const locationId = await getActiveLocation(await searchParams).catch(() => null)

  if (!locationId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">Nessuna location connessa.</p>
      </div>
    )
  }

  const [{ pipelines }, { opportunities: cachedOpps }] = await Promise.all([
    listPipelines(locationId),
    listOpportunities(locationId),
  ])

  // Map cached opportunities to the shape PipelineView expects
  const opportunities = cachedOpps.map((o) => ({
    id: o.ghl_id,
    name: o.name ?? undefined,
    pipelineId: o.pipeline_id ?? undefined,
    pipelineStageId: o.pipeline_stage_id ?? undefined,
    contactId: o.contact_ghl_id ?? undefined,
    monetaryValue: o.monetary_value != null ? Number(o.monetary_value) : undefined,
    status: o.status ?? undefined,
  }))

  // Map cached pipelines
  const pipelinesMapped = pipelines.map((p) => ({
    id: p.ghl_id,
    name: p.name ?? '',
    stages: p.stages ?? [],
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {opportunities.length} opportunità
          </p>
        </div>
        <Link
          href={`/designs/simfonia/pipeline/new?locationId=${locationId}`}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-black transition-all hover:opacity-90"
          style={{ background: '#00F0FF' }}
        >
          + Nuova Opportunità
        </Link>
      </div>

      {pipelinesMapped.length === 0 ? (
        <p className="text-sm text-gray-500">Nessuna pipeline trovata.</p>
      ) : (
        <PipelineView pipelines={pipelinesMapped} opportunities={opportunities} locationId={locationId} />
      )}
    </div>
  )
}
