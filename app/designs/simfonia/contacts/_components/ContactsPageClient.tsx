'use client'

import Link from 'next/link'
import useSWR from 'swr'
import ContactsList from './ContactsList'
import ContactsFilters from './ContactsFilters'
import ColumnPicker from './ColumnPicker'
import type { ContactColumn } from '../../settings/_actions'
import type { CustomFieldDef, CategoryDef } from '@/lib/utils/categoryFields'

type Contact = Record<string, unknown> & { id: string }

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Props {
  locationId: string
  columns: ContactColumn[]
  customFields: CustomFieldDef[]
  categories: CategoryDef[]
  allTags: string[]
  gestoreOptions: string[]
  categoryTags: Record<string, string[]>
  activeCategory: string | null
  activeTag: string | null
  activeGestore: string | null
  dateFrom: string | null
  dateTo: string | null
  scadenzaFrom: string | null
  scadenzaTo: string | null
  search: string | null
  categoryLabels: string[]
  categoriaFieldId: string | null
  gestoreFieldId: string | null
  scadenzaFieldIds: string[]
  activeCategoryLabel: string | null
}

export default function ContactsPageClient(props: Props) {
  const {
    locationId, columns, customFields, categories, allTags, gestoreOptions,
    categoryTags, activeCategory, activeTag, activeGestore, dateFrom, dateTo,
    scadenzaFrom, scadenzaTo, search, categoryLabels, categoriaFieldId,
    gestoreFieldId, scadenzaFieldIds, activeCategoryLabel,
  } = props

  // Build API URL with all filters
  const params = new URLSearchParams({ locationId })
  if (search) params.set('search', search)
  if (activeTag) params.set('tag', activeTag)
  if (categoryLabels.length > 0) params.set('categoryLabels', categoryLabels.join(','))
  if (categoriaFieldId) params.set('categoriaFieldId', categoriaFieldId)
  if (gestoreFieldId) params.set('gestoreFieldId', gestoreFieldId)
  if (activeGestore) params.set('gestore', activeGestore)
  if (dateFrom) params.set('dateFrom', dateFrom)
  if (dateTo) params.set('dateTo', dateTo)
  if (scadenzaFieldIds.length > 0) params.set('scadenzaFieldIds', scadenzaFieldIds.join(','))
  if (scadenzaFrom) params.set('scadenzaFrom', scadenzaFrom)
  if (scadenzaTo) params.set('scadenzaTo', scadenzaTo)

  const { data, isLoading } = useSWR(`/api/contacts?${params}`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  })

  const contacts: Contact[] = data?.contacts ?? []
  const total: number = data?.total ?? 0
  const hasFilters = !!(activeCategory || activeTag || activeGestore || dateFrom || dateTo || scadenzaFrom || scadenzaTo || search)
  const q = `?locationId=${locationId}`

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
              {isLoading ? (
                <span className="inline-block h-4 w-16 animate-pulse rounded bg-gray-200" />
              ) : (
                <>
                  <span className="font-semibold text-gray-700">{total}</span> contatti
                  {categoryLabels.length > 0 ? <span className="ml-1 text-[#2A00CC]"> · {categoryLabels.join(', ')}</span> : ''}
                  {activeTag ? ` · ${activeTag}` : ''}
                  {activeGestore ? ` · ${activeGestore}` : ''}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ColumnPicker
            locationId={locationId}
            savedColumns={columns}
            customFields={customFields}
            activeCategoryLabel={activeCategoryLabel}
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

      {isLoading ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#2A00CC]" />
          <p className="mt-3 text-sm text-gray-400">Caricamento contatti...</p>
        </div>
      ) : (
        <ContactsList
          contacts={contacts}
          locationId={locationId}
          columns={columns}
          customFields={customFields}
          availableTags={allTags}
          categoryTags={categoryTags}
        />
      )}

      {hasFilters && !isLoading && contacts.length === 0 && (
        <div className="text-center">
          <Link href={`/designs/simfonia/contacts${q}`} className="text-xs underline" style={{ color: '#2A00CC' }}>
            Rimuovi filtri
          </Link>
        </div>
      )}
    </div>
  )
}
