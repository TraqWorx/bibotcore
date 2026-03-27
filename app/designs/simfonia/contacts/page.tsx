import Link from 'next/link'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'
import { getCategoryTags, getContactColumns, getLocationTags, type ContactColumn } from '../settings/_actions'
import ContactsList from './_components/ContactsList'
import ContactsFilters from './_components/ContactsFilters'
import ColumnPicker from './_components/ColumnPicker'
import {
  discoverCategories,
  getCategoriaField,
  getFieldsForCategory,
  getProviderField,
  getScadenzaField,
  parseFieldCategory,
  type CustomFieldDef,
} from '@/lib/utils/categoryFields'

const BASE_URL = 'https://services.leadconnectorhq.com'

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

async function fetchCustomFields(token: string, locationId: string): Promise<CustomFieldDef[]> {
  try {
    const res = await fetch(`${BASE_URL}/locations/${locationId}/customFields`, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return ((data?.customFields ?? []) as CustomFieldDef[]).map((cf) => ({
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

/** Read a custom field value from a contact's customFields array */
function getContactCfValue(contact: Contact, fieldId: string): string {
  const cfArray = contact.customFields
  if (!Array.isArray(cfArray)) return ''
  const field = cfArray.find((f: Record<string, unknown>) => f.id === fieldId)
  if (!field) return ''
  const val = (field as Record<string, unknown>).value ?? (field as Record<string, unknown>).field_value ?? ''
  return String(val).trim()
}

async function fetchAllContacts(
  locationId: string,
  token: string,
): Promise<Contact[]> {
  const allContacts: Contact[] = []
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${BASE_URL}/contacts/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ locationId, pageLimit: 100, page }),
      cache: 'no-store',
    })
    if (!res.ok) break
    const data = await res.json()
    const contacts = (data?.contacts ?? []) as Contact[]
    allContacts.push(...contacts)
    if (contacts.length < 100) break
  }
  return allContacts
}

async function fetchContacts(
  locationId: string,
  token: string,
  categoryLabel: string | null,
  categoriaFieldId: string | null,
  activeTag: string | null,
  gestoreFieldId: string | null,
  activeGestore: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  scadenzaFieldIds: string[],
  scadenzaFrom: string | null,
  scadenzaTo: string | null,
  search: string | null,
): Promise<Contact[]> {
  // Build GHL-compatible filters (standard fields + tags only — NOT custom fields)
  const filters: { field: string; operator: string; value: string }[] = []

  // Sub-filter by tags (comma-separated for multi-select)
  if (activeTag) {
    for (const tag of activeTag.split(',')) {
      if (tag.trim()) {
        filters.push({ field: 'tags', operator: 'contains', value: tag.trim() })
      }
    }
  }

  // Created date range
  if (dateFrom) {
    filters.push({ field: 'dateAdded', operator: 'GTE', value: new Date(dateFrom + 'T00:00:00.000Z').toISOString() })
  }
  if (dateTo) {
    filters.push({ field: 'dateAdded', operator: 'LTE', value: new Date(dateTo + 'T23:59:59.999Z').toISOString() })
  }

  let contacts: Contact[]

  if (filters.length > 0 || search) {
    contacts = []
    for (let page = 1; page <= 5; page++) {
      const res = await fetch(`${BASE_URL}/contacts/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationId, pageLimit: 100, page,
          ...(filters.length > 0 ? { filters } : {}),
          ...(search ? { query: search } : {}),
        }),
        cache: 'no-store',
      })
      if (!res.ok) break
      const data = await res.json()
      const batch = (data?.contacts ?? []) as Contact[]
      contacts.push(...batch)
      if (batch.length < 100) break
    }
  } else {
    contacts = await fetchAllContacts(locationId, token)
  }

  // Client-side filter by Categoria custom field (GHL search can't filter by custom field IDs)
  if (categoryLabel && categoriaFieldId) {
    contacts = contacts.filter((c) => getContactCfValue(c, categoriaFieldId) === categoryLabel)
  }

  // Client-side filter by Gestore custom field
  if (activeGestore && gestoreFieldId) {
    contacts = contacts.filter((c) => getContactCfValue(c, gestoreFieldId) === activeGestore)
  }

  // Client-side filter by Scadenza date range (check any scadenza field across categories)
  if (scadenzaFieldIds.length > 0 && (scadenzaFrom || scadenzaTo)) {
    contacts = contacts.filter((c) => {
      // Match if ANY scadenza field falls within the range
      return scadenzaFieldIds.some((fieldId) => {
        const raw = getContactCfValue(c, fieldId)
        if (!raw) return false
        // Normalize to YYYY-MM-DD for comparison
        // Handles: ISO (2026-03-27T00:00:00.000Z), YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
        let val: string
        if (raw.includes('T')) {
          val = raw.slice(0, 10)
        } else if (raw.includes('/')) {
          const [d, m, y] = raw.split('/')
          val = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
        } else if (raw.match(/^\d{2}-\d{2}-\d{4}$/)) {
          const [d, m, y] = raw.split('-')
          val = `${y}-${m}-${d}`
        } else {
          val = raw.slice(0, 10)
        }
        if (scadenzaFrom && val < scadenzaFrom) return false
        if (scadenzaTo && val > scadenzaTo) return false
        return true
      })
    })
  }

  return contacts
}

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
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">Nessuna location connessa.</p>
      </div>
    )
  }

  const token = await getGhlTokenForLocation(locationId).catch(() => null)

  const [savedDefaultColumns, customFields, locationTags, categoryTagsMap] = await Promise.all([
    getContactColumns(locationId),
    token ? fetchCustomFields(token, locationId) : Promise.resolve([]),
    getLocationTags(locationId),
    getCategoryTags(locationId).catch(() => ({} as Record<string, string[]>)),
  ])

  // Discover categories from the Categoria dropdown field
  const categories = discoverCategories(customFields)
  const categoriaField = getCategoriaField(customFields)
  const categoriaFieldId = categoriaField?.id ?? null

  // Resolve category label
  const categoryLabel = activeCategory
    ? categories.find((c) => c.slug === activeCategory)?.label ?? null
    : null

  // Get gestore (provider) field for the active category, or all options for "Tutte"
  const gestoreField = categoryLabel
    ? getProviderField(customFields, categoryLabel)
    : null
  const gestoreFieldId = gestoreField?.id ?? null
  const gestoreOptions = categoryLabel
    ? (gestoreField?.picklistOptions ?? [])
    : getAllGestoreOptions(customFields, categories)

  // Get scadenza field(s) — single field for a category, or all scadenza fields for "Tutte"
  const scadenzaFieldIds: string[] = categoryLabel
    ? [getScadenzaField(customFields, categoryLabel)?.id].filter((id): id is string => !!id)
    : categories.map((c) => getScadenzaField(customFields, c.label)?.id).filter((id): id is string => !!id)

  const contacts = token
    ? await fetchContacts(
        locationId, token, categoryLabel, categoriaFieldId,
        activeTag, gestoreFieldId, activeGestore,
        dateFrom, dateTo, scadenzaFieldIds, scadenzaFrom, scadenzaTo, search,
      )
    : []

  // Load per-category saved columns if a category is active
  const savedCategoryColumns = categoryLabel
    ? await getContactColumns(locationId, categoryLabel)
    : []

  // Use saved category columns if available, otherwise generate defaults
  const columns = activeCategory && categoryLabel
    ? (savedCategoryColumns.length > 0 ? savedCategoryColumns : buildCategoryColumns(customFields, categoryLabel))
    : (savedDefaultColumns.length > 0 ? savedDefaultColumns : DEFAULT_COLUMNS)

  const hasFilters = !!(activeCategory || activeTag || activeGestore || dateFrom || dateTo || scadenzaFrom || scadenzaTo || search)
  const q = `?locationId=${locationId}`
  const allTagNames = locationTags.map((t) => t.name)

  // Filter tags by category if a category is selected and has associated tags
  const categoryAssociatedTags = categoryLabel ? (categoryTagsMap[categoryLabel] ?? []) : []
  const allTags = categoryLabel && categoryAssociatedTags.length > 0
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
              {categoryLabel ? <span className="ml-1 text-[#2A00CC]"> · {categoryLabel}</span> : ''}
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
