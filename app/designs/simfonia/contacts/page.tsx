import Link from 'next/link'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'
import { createAdminClient } from '@/lib/supabase-server'
import { getContactColumns, getLocationTags, type ContactColumn } from '../settings/_actions'
import ContactsList from './_components/ContactsList'
import ContactsFilters from './_components/ContactsFilters'
import ColumnPicker from './_components/ColumnPicker'

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

async function getContactFilters(locationId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('location_settings')
    .select('contact_filters')
    .eq('location_id', locationId)
    .single()
  const filters = (data as { contact_filters?: string[] } | null)?.contact_filters
  return Array.isArray(filters) ? filters : []
}

interface CustomFieldDef {
  id: string
  name: string
  fieldKey: string
  dataType: string
  placeholder?: string
}

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
    }))
  } catch {
    return []
  }
}

async function fetchContacts(
  locationId: string,
  token: string,
  activeFilter: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  search: string | null,
): Promise<Contact[]> {
  const filters: { field: string; operator: string; value: string }[] = []
  if (activeFilter) {
    filters.push({ field: 'tags', operator: 'contains', value: activeFilter })
  }
  if (dateFrom) {
    filters.push({ field: 'dateAdded', operator: 'GTE', value: new Date(dateFrom + 'T00:00:00.000Z').toISOString() })
  }
  if (dateTo) {
    filters.push({ field: 'dateAdded', operator: 'LTE', value: new Date(dateTo + 'T23:59:59.999Z').toISOString() })
  }

  if (filters.length > 0 || search) {
    const allContacts: Contact[] = []
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
        next: { revalidate: 60 },
      })
      if (!res.ok) break
      const data = await res.json()
      const contacts = (data?.contacts ?? []) as Contact[]
      allContacts.push(...contacts)
      if (contacts.length < 100) break
    }
    return allContacts
  }

  const allContacts: Contact[] = []
  let startAfterId: string | undefined
  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({ locationId, limit: '100' })
    if (startAfterId) params.set('startAfterId', startAfterId)
    const res = await fetch(`${BASE_URL}/contacts/?${params}`, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
      next: { revalidate: 60 },
    })
    if (!res.ok) break
    const data = await res.json()
    const contacts = (data?.contacts ?? []) as Contact[]
    allContacts.push(...contacts)
    if (contacts.length < 100) break
    startAfterId = contacts[contacts.length - 1].id
  }
  return allContacts
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const locationId = await getActiveLocation(sp).catch(() => null)
  const activeFilter = typeof sp.filter === 'string' ? sp.filter : null
  const dateFrom = typeof sp.dateFrom === 'string' ? sp.dateFrom : null
  const dateTo = typeof sp.dateTo === 'string' ? sp.dateTo : null
  const search = typeof sp.search === 'string' ? sp.search : null

  if (!locationId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">Nessuna location connessa.</p>
      </div>
    )
  }

  const token = await getGhlTokenForLocation(locationId).catch(() => null)

  const [filterTags, contacts, savedColumns, customFields, locationTags] = await Promise.all([
    getContactFilters(locationId),
    token ? fetchContacts(locationId, token, activeFilter, dateFrom, dateTo, search) : Promise.resolve([]),
    getContactColumns(locationId),
    token ? fetchCustomFields(token, locationId) : Promise.resolve([]),
    getLocationTags(locationId),
  ])

  const columns = savedColumns.length > 0 ? savedColumns : DEFAULT_COLUMNS
  const hasFilters = !!(activeFilter || dateFrom || dateTo || search)
  const q = `?locationId=${locationId}`

  const allTags = locationTags.map((t) => t.name)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contatti</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {contacts.length} contatti{activeFilter ? ` · ${activeFilter}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ColumnPicker
            locationId={locationId}
            savedColumns={columns}
            customFields={customFields}
          />
          <Link
            href={`/designs/simfonia/contacts/new${q}`}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-black transition-all hover:opacity-90"
            style={{ background: '#00F0FF' }}
          >
            + Nuovo Contatto
          </Link>
        </div>
      </div>

      <ContactsFilters
        locationId={locationId}
        filterTags={filterTags}
        activeFilter={activeFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        search={search}
      />

      <ContactsList contacts={contacts} locationId={locationId} columns={columns} customFields={customFields} availableTags={allTags} />

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
