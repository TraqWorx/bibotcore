import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { getCategoryTags, ensureCategorySwitchOutFields } from '../../settings/_actions'
import { getCustomFieldDefs } from '@/lib/data/contacts'
import { createAdminClient } from '@/lib/supabase-server'
import NewContactForm from './_components/NewContactForm'

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const locationId = await getActiveLocation(await searchParams)

  // Ensure per-category Switch Out fields exist (writes to GHL — ok to fail silently)
  await ensureCategorySwitchOutFields(locationId).catch(() => {})

  const sb = createAdminClient()

  const [customFields, { data: cachedTags }, categoryTagsMap] = await Promise.all([
    getCustomFieldDefs(locationId),
    sb.from('cached_tags').select('name').eq('location_id', locationId),
    getCategoryTags(locationId).catch(() => ({} as Record<string, string[]>)),
  ])

  const ghlTags = (cachedTags ?? []).map((t) => t.name)

  return <NewContactForm locationId={locationId} tags={ghlTags} customFields={customFields} categoryTags={categoryTagsMap} />
}
