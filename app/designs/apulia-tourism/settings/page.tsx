import { getActiveLocation } from '@/lib/location/getActiveLocation'
import SettingsClient from './_components/SettingsClient'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const locationId = await getActiveLocation(sp).catch(() => null)

  if (!locationId) {
    return (
      <div className="rounded-2xl border p-10 text-center" style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-surface)' }}>
        <p className="text-sm" style={{ color: 'var(--shell-muted)' }}>No location connected.</p>
      </div>
    )
  }

  return <SettingsClient locationId={locationId} />
}
