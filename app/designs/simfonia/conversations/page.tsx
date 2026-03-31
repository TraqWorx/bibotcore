import { getActiveLocation } from '@/lib/location/getActiveLocation'
import ConversationsClient from './_components/ConversationsClient'

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const locationId = await getActiveLocation(sp).catch(() => null)

  if (!locationId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">Nessuna location connessa.</p>
      </div>
    )
  }

  return <ConversationsClient locationId={locationId} />
}
