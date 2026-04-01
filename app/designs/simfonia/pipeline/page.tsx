import { getActiveLocation } from '@/lib/location/getActiveLocation'
import PipelineClient from './_components/PipelineClient'
import { sf } from '@/lib/simfonia/ui'

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const locationId = await getActiveLocation(await searchParams).catch(() => null)

  if (!locationId) {
    return (
      <div className={`${sf.emptyPanel}`}>
        <p className="text-sm font-medium text-gray-500">Nessuna location connessa.</p>
      </div>
    )
  }

  return <PipelineClient locationId={locationId} />
}
