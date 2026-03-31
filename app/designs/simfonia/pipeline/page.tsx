import { getActiveLocation } from '@/lib/location/getActiveLocation'
import PipelineClient from './_components/PipelineClient'

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

  return <PipelineClient locationId={locationId} />
}
