import { createAdminClient } from '@/lib/supabase-server'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import NewAppointmentForm from './_components/NewAppointmentForm'

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
  const supabase = createAdminClient()

  const [{ data: cachedCalendars }, { data: cachedContacts }, { data: cachedUsers }, { data: availabilityRows }] = await Promise.all([
    supabase.from('cached_calendars').select('ghl_id, name').eq('location_id', locationId),
    supabase.from('cached_contacts').select('ghl_id, first_name, last_name, email, phone').eq('location_id', locationId).order('first_name'),
    supabase.from('cached_ghl_users').select('ghl_id, name, first_name, last_name').eq('location_id', locationId),
    supabase.from('user_availability').select('ghl_user_id, day_of_week, start_time, end_time, enabled').eq('location_id', locationId),
  ])

  const calendars = (cachedCalendars ?? []).map((c) => ({ id: c.ghl_id, name: c.name ?? '' }))
  const contacts = (cachedContacts ?? []).map((c) => ({
    id: c.ghl_id,
    firstName: c.first_name ?? '',
    lastName: c.last_name ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
  }))
  const users = (cachedUsers ?? []).map((u) => ({
    id: u.ghl_id,
    name: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.ghl_id,
  }))
  const availability = (availabilityRows ?? []) as AvailabilitySlot[]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Nuovo Appuntamento</h1>
      <NewAppointmentForm
        calendars={calendars}
        contacts={contacts}
        users={users}
        availability={availability}
        locationId={locationId}
      />
    </div>
  )
}
