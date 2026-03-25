import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'
import { getLocationTags } from '../../settings/_actions'
import NewContactForm from './_components/NewContactForm'

const BASE_URL = 'https://services.leadconnectorhq.com'

export interface GhlCustomField {
  id: string
  name: string
  fieldKey: string
  dataType: string // TEXT, NUMBER, DATE, CHECKBOX, etc.
  placeholder?: string
}

async function fetchCustomFields(token: string, locationId: string): Promise<GhlCustomField[]> {
  try {
    const res = await fetch(`${BASE_URL}/locations/${locationId}/customFields`, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.customFields ?? []) as GhlCustomField[]
  } catch {
    return []
  }
}

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const locationId = await getActiveLocation(await searchParams)
  const token = await getGhlTokenForLocation(locationId).catch(() => null)

  const [locationTagsList, customFields] = await Promise.all([
    getLocationTags(locationId),
    token ? fetchCustomFields(token, locationId) : Promise.resolve([]),
  ])

  const ghlTags = locationTagsList.map((t) => t.name)

  return <NewContactForm locationId={locationId} tags={ghlTags} customFields={customFields} />
}
