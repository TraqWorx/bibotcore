import Link from 'next/link'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { getCategoryTags, getContactColumns, getLocationTags, type ContactColumn } from '../settings/_actions'
import { getCustomFieldDefs } from '@/lib/data/contacts'
import ContactsPageClient from './_components/ContactsPageClient'
import { sf } from '@/lib/simfonia/ui'
import {
  discoverCategories,
  getCategoriaField,
  getProviderField,
  getScadenzaField,
  getFieldsForCategory,
  parseFieldCategory,
  type CustomFieldDef,
} from '@/lib/utils/categoryFields'

const DEFAULT_COLUMNS: ContactColumn[] = [
  { key: 'contactName', label: 'Contact Name', type: 'standard' },
  { key: 'phone', label: 'Phone', type: 'standard' },
  { key: 'email', label: 'Email', type: 'standard' },
  { key: 'companyName', label: 'Business Name', type: 'standard' },
  { key: 'dateAdded', label: 'Created', type: 'standard' },
  { key: 'lastActivity', label: 'Last Activity', type: 'standard' },
  { key: 'tags', label: 'Tags', type: 'standard' },
]

function buildCategoryColumns(customFields: CustomFieldDef[], categoryLabel: string): ContactColumn[] {
  const catFields = getFieldsForCategory(customFields, categoryLabel)
  const base: ContactColumn[] = [
    { key: 'contactName', label: 'Contact Name', type: 'standard' },
    { key: 'phone', label: 'Phone', type: 'standard' },
    { key: 'email', label: 'Email', type: 'standard' },
  ]
  const custom: ContactColumn[] = catFields.map((f) => {
    const { displayName } = parseFieldCategory(f.name)
    return { key: f.id, label: displayName, type: 'custom' }
  })
  return [...base, ...custom]
}

function getAllGestoreOptions(customFields: CustomFieldDef[], categories: { label: string }[]): string[] {
  const allOptions = new Set<string>()
  for (const cat of categories) {
    const pf = getProviderField(customFields, cat.label)
    if (pf?.picklistOptions) {
      for (const opt of pf.picklistOptions) allOptions.add(opt)
    }
  }
  return Array.from(allOptions).sort()
}

/**
 * Server component — renders the page shell and passes config to the client.
 * Contact data is fetched client-side via SWR for instant page loads.
 */
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const locationId = await getActiveLocation(sp).catch(() => null)
  const activeCategory = typeof sp.category === 'string' ? sp.category : null
  const activeTag = typeof sp.tag === 'string' ? sp.tag : null
  const activeGestore = typeof sp.gestore === 'string' ? sp.gestore : null
  const dateFrom = typeof sp.dateFrom === 'string' ? sp.dateFrom : null
  const dateTo = typeof sp.dateTo === 'string' ? sp.dateTo : null
  const scadenzaFrom = typeof sp.scadenzaFrom === 'string' ? sp.scadenzaFrom : null
  const scadenzaTo = typeof sp.scadenzaTo === 'string' ? sp.scadenzaTo : null
  const search = typeof sp.search === 'string' ? sp.search : null

  if (!locationId) {
    return (
      <div className={sf.emptyPanel}>
        <p className="text-sm font-medium text-gray-500">Nessuna location connessa.</p>
        <p className="mt-1 text-xs text-gray-400">Seleziona una location valida e riprova.</p>
      </div>
    )
  }

  // Light server-side fetch: config data only (fast — no contact data)
  const [savedDefaultColumns, customFields, locationTags, categoryTagsMap] = await Promise.all([
    getContactColumns(locationId),
    getCustomFieldDefs(locationId),
    getLocationTags(locationId),
    getCategoryTags(locationId).catch(() => ({} as Record<string, string[]>)),
  ])

  const categories = discoverCategories(customFields)
  const categoriaField = getCategoriaField(customFields)
  const categoriaFieldId = categoriaField?.id ?? null

  const activeSlugs = activeCategory ? activeCategory.split(',').map(s => s.trim()).filter(Boolean) : []
  const categoryLabels = activeSlugs
    .map((slug) => categories.find((c) => c.slug === slug)?.label)
    .filter((l): l is string => !!l)
  const categoryLabel = categoryLabels.length === 1 ? categoryLabels[0] : null

  const gestoreField = categoryLabel ? getProviderField(customFields, categoryLabel) : null
  const gestoreFieldId = gestoreField?.id ?? null
  const gestoreOptions = categoryLabel
    ? (gestoreField?.picklistOptions ?? [])
    : categoryLabels.length > 0
      ? getAllGestoreOptions(customFields, categoryLabels.map((l) => ({ label: l })))
      : getAllGestoreOptions(customFields, categories)

  const scadenzaFieldIds: string[] = categoryLabel
    ? [getScadenzaField(customFields, categoryLabel)?.id].filter((id): id is string => !!id)
    : categoryLabels.length > 0
      ? categoryLabels.map((l) => getScadenzaField(customFields, l)?.id).filter((id): id is string => !!id)
      : categories.map((c) => getScadenzaField(customFields, c.label)?.id).filter((id): id is string => !!id)

  const savedCategoryColumns = categoryLabel
    ? await getContactColumns(locationId, categoryLabel)
    : []

  const columns = categoryLabel
    ? (savedCategoryColumns.length > 0 ? savedCategoryColumns : buildCategoryColumns(customFields, categoryLabel))
    : (savedDefaultColumns.length > 0 ? savedDefaultColumns : DEFAULT_COLUMNS)

  const allTagNames = locationTags.map((t) => t.name)
  const categoryAssociatedTags = categoryLabels.length > 0
    ? Array.from(new Set(categoryLabels.flatMap((l) => categoryTagsMap[l] ?? [])))
    : []
  const allTags = categoryAssociatedTags.length > 0
    ? allTagNames.filter((t) => categoryAssociatedTags.includes(t))
    : allTagNames

  return (
    <ContactsPageClient
      locationId={locationId}
      columns={columns}
      customFields={customFields}
      categories={categories}
      allTags={allTags}
      gestoreOptions={gestoreOptions}
      categoryTags={categoryTagsMap}
      activeCategory={activeCategory}
      activeTag={activeTag}
      activeGestore={activeGestore}
      dateFrom={dateFrom}
      dateTo={dateTo}
      scadenzaFrom={scadenzaFrom}
      scadenzaTo={scadenzaTo}
      search={search}
      categoryLabels={categoryLabels}
      categoriaFieldId={categoriaFieldId}
      gestoreFieldId={gestoreFieldId}
      scadenzaFieldIds={scadenzaFieldIds}
      activeCategoryLabel={categoryLabel}
    />
  )
}
