import { getActiveLocation } from '@/lib/location/getActiveLocation'
import DashboardClient from './_components/DashboardClient'

export default async function CrmDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const locationId = await getActiveLocation(sp).catch(() => null)

  if (!locationId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">Nessuna location connessa. Riconnetti il tuo account GHL.</p>
      </div>
    )
  }

  return <DashboardClient locationId={locationId} />
}
