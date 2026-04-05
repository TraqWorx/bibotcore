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
      <div className="rounded-[28px] border border-[var(--shell-line)] bg-[var(--shell-surface)] p-10 text-center shadow-[0_14px_32px_-28px_rgba(23,21,18,0.2)]">
        <p className="text-sm text-[var(--shell-muted)]">Nessuna location connessa.</p>
      </div>
    )
  }

  return <ConversationsClient locationId={locationId} />
}
