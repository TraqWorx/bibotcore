import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'
import { getCategoryTags, getLocationTags, ensureCategorySwitchOutFields } from '../../settings/_actions'
import NewContactForm from './_components/NewContactForm'
import type { CustomFieldDef } from '@/lib/utils/categoryFields'

const BASE_URL = 'https://services.leadconnectorhq.com'

export type GhlCustomField = CustomFieldDef

async function fetchCustomFields(token: string, locationId: string): Promise<CustomFieldDef[]> {
  try {
    const res = await fetch(`${BASE_URL}/locations/${locationId}/customFields`, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return ((data?.customFields ?? []) as GhlCustomField[]).map((cf) => ({
      id: cf.id,
      name: cf.name,
      fieldKey: cf.fieldKey ?? cf.id,
      dataType: cf.dataType ?? 'TEXT',
      placeholder: cf.placeholder,
      picklistOptions: cf.picklistOptions,
    }))
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

  // Ensure per-category Switch Out fields exist in GHL BEFORE fetching custom fields
  await ensureCategorySwitchOutFields(locationId)

  const [locationTagsList, customFields, categoryTagsMap] = await Promise.all([
    getLocationTags(locationId),
    token ? fetchCustomFields(token, locationId) : Promise.resolve([]),
    getCategoryTags(locationId).catch(() => ({} as Record<string, string[]>)),
  ])

  const ghlTags = locationTagsList.map((t) => t.name)

  return <NewContactForm locationId={locationId} tags={ghlTags} customFields={customFields} categoryTags={categoryTagsMap} />
}
