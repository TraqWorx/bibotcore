import Link from 'next/link'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { getCategoryTags, getContactColumns, getLocationTags, type ContactColumn } from '../settings/_actions'
import { listContacts, getCustomFieldDefs, getContact } from '@/lib/data/contacts'
import ContactsList from './_components/ContactsList'
import ContactsFilters from './_components/ContactsFilters'
import ColumnPicker from './_components/ColumnPicker'
import {
  discoverCategories,
  getCategoriaField,
  getProviderField,
  getScadenzaField,
  getFieldsForCategory,
  parseFieldCategory,
  type CustomFieldDef,
} from '@/lib/utils/categoryFields'

type Contact = Record<string, unknown> & { id: string }

const DEFAULT_COLUMNS: ContactColumn[] = [
  { key: 'contactName', label: 'Contact Name', type: 'standard' },
  { key: 'phone', label: 'Phone', type: 'standard' },
  { key: 'email', label: 'Email', type: 'standard' },
  { key: 'companyName', label: 'Business Name', type: 'standard' },
  { key: 'dateAdded', label: 'Created', type: 'standard' },
  { key: 'lastActivity', label: 'Last Activity', type: 'standard' },
  { key: 'tags', label: 'Tags', type: 'standard' },
]

/** Build dynamic columns from category custom fields */
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

/** Collect all gestore/provider picklist options across all categories */
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

/** Convert cached contact to the Contact shape expected by child components */
function cachedToContact(c: {
  ghl_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  company_name: string | null
  address1: string | null
  city: string | null
  tags: string[]
  date_added: string | null
  last_activity: string | null
  raw?: Record<string, unknown> | null
}): Contact {
  // If we have the raw GHL payload, use it directly (it has customFields etc)
  if (c.raw && typeof c.raw === 'object' && 'firstName' in c.raw) {
    return { ...c.raw, id: c.ghl_id } as Contact
  }
  // Otherwise build a minimal Contact from cached columns
  return {
    id: c.ghl_id,
    firstName: c.first_name ?? '',
    lastName: c.last_name ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    companyName: c.company_name ?? '',
    address1: c.address1 ?? '',
    city: c.city ?? '',
    tags: c.tags ?? [],
    dateAdded: c.date_added ?? '',
    lastActivity: c.last_activity ?? '',
    customFields: [],
  } as Contact
}

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
  const newContactId = typeof sp.newContact === 'string' ? sp.newContact : null

  if (!locationId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">Nessuna location connessa.</p>
      </div>
    )
  }

  const [savedDefaultColumns, customFields, locationTags, categoryTagsMap] = await Promise.all([
    getContactColumns(locationId),
    getCustomFieldDefs(locationId),
    getLocationTags(locationId),
    getCategoryTags(locationId).catch(() => ({} as Record<string, string[]>)),
  ])

  // Discover categories from the Categoria dropdown field
  const categories = discoverCategories(customFields)
  const categoriaField = getCategoriaField(customFields)
  const categoriaFieldId = categoriaField?.id ?? null

  // Resolve category labels — activeCategory can be comma-separated slugs
  const activeSlugs = activeCategory ? activeCategory.split(',').map(s => s.trim()).filter(Boolean) : []
  const categoryLabels = activeSlugs
    .map((slug) => categories.find((c) => c.slug === slug)?.label)
    .filter((l): l is string => !!l)
  const categoryLabel = categoryLabels.length === 1 ? categoryLabels[0] : null

  // Get gestore (provider) field for the active category
  const gestoreField = categoryLabel
    ? getProviderField(customFields, categoryLabel)
    : null
  const gestoreFieldId = gestoreField?.id ?? null
  const gestoreOptions = categoryLabel
    ? (gestoreField?.picklistOptions ?? [])
    : categoryLabels.length > 0
      ? getAllGestoreOptions(customFields, categoryLabels.map((l) => ({ label: l })))
      : getAllGestoreOptions(customFields, categories)

  // Get scadenza field(s)
  const scadenzaFieldIds: string[] = categoryLabel
    ? [getScadenzaField(customFields, categoryLabel)?.id].filter((id): id is string => !!id)
    : categoryLabels.length > 0
      ? categoryLabels.map((l) => getScadenzaField(customFields, l)?.id).filter((id): id is string => !!id)
      : categories.map((c) => getScadenzaField(customFields, c.label)?.id).filter((id): id is string => !!id)

  // ─── Fetch contacts from Supabase cache (with GHL fallback) ───────────────
  const { contacts: cachedContacts } = await listContacts(locationId, {
    categoryLabels,
    categoriaFieldId,
    tag: activeTag,
    gestoreFieldId,
    gestore: activeGestore,
    dateFrom,
    dateTo,
    scadenzaFieldIds,
    scadenzaFrom,
    scadenzaTo,
    search,
  })

  // Fetch custom field values for all listed contacts in ONE batch query
  const contactGhlIds = cachedContacts.map((c) => c.ghl_id)
  const { createAdminClient: createSb } = await import('@/lib/supabase-server')
  const sb = createSb()
  const { data: allCfValues } = contactGhlIds.length > 0
    ? await sb.from('cached_contact_custom_fields')
        .select('contact_ghl_id, field_id, value')
        .eq('location_id', locationId)
        .in('contact_ghl_id', contactGhlIds)
    : { data: [] }

  // Build a map: contactId → customFields array (GHL format)
  const cfByContact = new Map<string, { id: string; value: string }[]>()
  for (const row of allCfValues ?? []) {
    if (!cfByContact.has(row.contact_ghl_id)) cfByContact.set(row.contact_ghl_id, [])
    if (row.value) cfByContact.get(row.contact_ghl_id)!.push({ id: row.field_id, value: row.value })
  }

  let contacts: Contact[] = cachedContacts.map((c) => {
    const base = cachedToContact(c)
    // Attach custom fields from batch query
    if (!base.customFields || (base.customFields as unknown[]).length === 0) {
      (base as Record<string, unknown>).customFields = cfByContact.get(c.ghl_id) ?? []
    }
    return base
  })

  // If a newly created contact isn't in results yet, fetch it from cache
  if (newContactId && !contacts.some((c) => c.id === newContactId)) {
    const newContact = await getContact(locationId, newContactId)
    if (newContact) contacts.unshift(cachedToContact(newContact))
  }

  // Load per-category saved columns if exactly one category is active
  const savedCategoryColumns = categoryLabel
    ? await getContactColumns(locationId, categoryLabel)
    : []

  const columns = categoryLabel
    ? (savedCategoryColumns.length > 0 ? savedCategoryColumns : buildCategoryColumns(customFields, categoryLabel))
    : (savedDefaultColumns.length > 0 ? savedDefaultColumns : DEFAULT_COLUMNS)

  const hasFilters = !!(activeCategory || activeTag || activeGestore || dateFrom || dateTo || scadenzaFrom || scadenzaTo || search)
  const q = `?locationId=${locationId}`
  const allTagNames = locationTags.map((t) => t.name)

  // Filter tags by category if categories are selected and have associated tags
  const categoryAssociatedTags = categoryLabels.length > 0
    ? Array.from(new Set(categoryLabels.flatMap((l) => categoryTagsMap[l] ?? [])))
    : []
  const allTags = categoryAssociatedTags.length > 0
    ? allTagNames.filter((t) => categoryAssociatedTags.includes(t))
    : allTagNames

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2A00CC] to-[#6366f1]">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contatti</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              <span className="font-semibold text-gray-700">{contacts.length}</span> contatti
              {categoryLabels.length > 0 ? <span className="ml-1 text-[#2A00CC]"> · {categoryLabels.join(', ')}</span> : ''}
              {activeTag ? ` · ${activeTag}` : ''}
              {activeGestore ? ` · ${activeGestore}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ColumnPicker
            locationId={locationId}
            savedColumns={columns}
            customFields={customFields}
            activeCategoryLabel={categoryLabel}
          />
          <Link
            href={`/designs/simfonia/contacts/new${q}`}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#00d4e0] px-5 py-2.5 text-sm font-semibold text-black shadow-sm transition-all hover:shadow-md hover:brightness-105"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuovo Contatto
          </Link>
        </div>
      </div>

      <ContactsFilters
        locationId={locationId}
        categories={categories}
        allTags={allTags}
        gestoreOptions={gestoreOptions}
        activeCategory={activeCategory}
        activeTag={activeTag}
        activeGestore={activeGestore}
        dateFrom={dateFrom}
        dateTo={dateTo}
        scadenzaFrom={scadenzaFrom}
        scadenzaTo={scadenzaTo}
        search={search}
      />

      <ContactsList contacts={contacts} locationId={locationId} columns={columns} customFields={customFields} availableTags={allTags} categoryTags={categoryTagsMap} />

      {hasFilters && contacts.length === 0 && (
        <div className="text-center">
          <Link href={`/designs/simfonia/contacts${q}`} className="text-xs underline" style={{ color: '#2A00CC' }}>
            Rimuovi filtri
          </Link>
        </div>
      )}
    </div>
  )
}
