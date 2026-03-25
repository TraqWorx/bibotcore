import { createAdminClient } from '@/lib/supabase-server'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import NewAppointmentForm from './_components/NewAppointmentForm'

const BASE_URL = 'https://services.leadconnectorhq.com'

interface GhlUser { id: string; name: string }

async function fetchGhlUsers(token: string, locationId: string): Promise<GhlUser[]> {
  try {
    const res = await fetch(`${BASE_URL}/users/?locationId=${locationId}`, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return ((data?.users ?? []) as { id: string; name?: string; firstName?: string; lastName?: string }[]).map((u) => ({
      id: u.id,
      name: u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.id,
    }))
  } catch {
    return []
  }
}

export interface AvailabilitySlot {
  ghl_user_id: string
  day_of_week: number
  start_time: string
  end_time: string
  enabled: boolean
}

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const locationId = await getActiveLocation(await searchParams)
  const ghl = await getGhlClient(locationId)
  const token = await getGhlTokenForLocation(locationId).catch(() => null)
  const supabase = createAdminClient()

  const [calendarsData, contactsData, ghlUsers, { data: availabilityRows }] = await Promise.all([
    ghl.calendars.list(),
    ghl.contacts.list(),
    token ? fetchGhlUsers(token, locationId) : Promise.resolve([]),
    supabase
      .from('user_availability')
      .select('ghl_user_id, day_of_week, start_time, end_time, enabled')
      .eq('location_id', locationId),
  ])

  const calendars = calendarsData?.calendars ?? []
  const contacts = contactsData?.contacts ?? []
  const availability = (availabilityRows ?? []) as AvailabilitySlot[]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Nuovo Appuntamento</h1>
      <NewAppointmentForm
        calendars={calendars}
        contacts={contacts}
        users={ghlUsers.map((u) => ({ id: u.id, name: u.name }))}
        availability={availability}
        locationId={locationId}
      />
    </div>
  )
}
