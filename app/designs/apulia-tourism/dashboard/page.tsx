import { getActiveLocation } from '@/lib/location/getActiveLocation'
import DashboardClient from './_components/DashboardClient'
import { sf } from '@/lib/simfonia/ui'

export default async function CrmDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const locationId = await getActiveLocation(sp).catch(() => null)

  if (!locationId) {
    return (
      <div className={sf.emptyPanel}>
        <p className="text-sm font-medium text-gray-500">Nessuna location connessa.</p>
        <p className="mt-1 text-xs text-gray-400">Riconnetti il tuo account GHL o seleziona una location valida.</p>
      </div>
    )
  }

  return <DashboardClient locationId={locationId} />
}
