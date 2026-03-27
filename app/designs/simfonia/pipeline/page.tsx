import Link from 'next/link'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
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

  const ghl = await getGhlClient(locationId)
  let pipelines: { id: string; name: string; stages: { id: string; name: string }[] }[] = []
  let opportunities: { id: string; name?: string; pipelineId?: string; pipelineStageId?: string; monetaryValue?: number; status?: string }[] = []

  try {
    const [opportunitiesData, pipelinesData] = await Promise.all([
      ghl.opportunities.list().catch(() => null),
      ghl.pipelines.list().catch(() => null),
    ])
    pipelines = pipelinesData?.pipelines ?? []
    opportunities = opportunitiesData?.opportunities ?? []
  } catch {
    // Silently handle — empty arrays are the fallback
  }

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

      {pipelines.length === 0 ? (
        <p className="text-sm text-gray-500">Nessuna pipeline trovata.</p>
      ) : (
        <PipelineView pipelines={pipelines} opportunities={opportunities} locationId={locationId} />
      )}
    </div>
  )
}
