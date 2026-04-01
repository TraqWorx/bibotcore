'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import SimfoniaPageHeader from '../../_components/SimfoniaPageHeader'
import { sf } from '@/lib/simfonia/ui'
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
  const { locationId, columns, customFields, categories, allTags, gestoreOptions, categoryTags, categoriaFieldId, gestoreFieldId, scadenzaFieldIds, activeCategoryLabel } = props

  // Client-side filter state — initialized from server props (URL params)
  const [filters, setFilters] = useState({
    category: props.activeCategory,
    tag: props.activeTag,
    gestore: props.activeGestore,
    dateFrom: props.dateFrom,
    dateTo: props.dateTo,
    scadenzaFrom: props.scadenzaFrom,
    scadenzaTo: props.scadenzaTo,
    search: props.search,
  })

  const categoryLabels = useMemo(() => {
    const slugs = filters.category ? filters.category.split(',').filter(Boolean) : []
    return slugs.map((slug) => categories.find((c) => c.slug === slug)?.label).filter((l): l is string => !!l)
  }, [filters.category, categories])

  // Build API URL from current filter state
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams({ locationId })
    if (filters.search) params.set('search', filters.search)
    if (filters.tag) params.set('tag', filters.tag)
    if (categoryLabels.length > 0) params.set('categoryLabels', categoryLabels.join(','))
    if (categoriaFieldId) params.set('categoriaFieldId', categoriaFieldId)
    if (gestoreFieldId) params.set('gestoreFieldId', gestoreFieldId)
    if (filters.gestore) params.set('gestore', filters.gestore)
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)
    if (scadenzaFieldIds.length > 0) params.set('scadenzaFieldIds', scadenzaFieldIds.join(','))
    if (filters.scadenzaFrom) params.set('scadenzaFrom', filters.scadenzaFrom)
    if (filters.scadenzaTo) params.set('scadenzaTo', filters.scadenzaTo)
    return `/api/contacts?${params}`
  }, [locationId, filters, categoryLabels, categoriaFieldId, gestoreFieldId, scadenzaFieldIds])

  const { data, isLoading } = useSWR(apiUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  const contacts: Contact[] = data?.contacts ?? []
  const total: number = data?.total ?? 0
  const hasFilters = !!(filters.category || filters.tag || filters.gestore || filters.dateFrom || filters.dateTo || filters.scadenzaFrom || filters.scadenzaTo || filters.search)
  const q = `?locationId=${locationId}`

  const [isFilterPending, startFilterTransition] = useTransition()

  function handleFilterChange(overrides: Record<string, string | null>) {
    // Use startTransition so the filter button paint isn't blocked by list re-render
    startFilterTransition(() => {
      setFilters((prev) => ({ ...prev, ...overrides }))
    })
  }

  return (
    <div className="space-y-7">
      <SimfoniaPageHeader
        eyebrow="Anagrafica"
        title="Contatti"
        description={
          isLoading && !data ? (
            <span className="inline-block h-4 w-32 animate-pulse rounded bg-gray-200/80" />
          ) : (
            <>
              <span className="font-semibold text-gray-800">{total}</span> in elenco
              {categoryLabels.length > 0 ? <span className="text-brand"> · {categoryLabels.join(', ')}</span> : ''}
              {filters.tag ? ` · ${filters.tag}` : ''}
              {filters.gestore ? ` · ${filters.gestore}` : ''}
            </>
          )
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <ColumnPicker
              locationId={locationId}
              savedColumns={columns}
              customFields={customFields}
              activeCategoryLabel={activeCategoryLabel}
            />
            <Link
              href={`/designs/simfonia/contacts/new${q}`}
              className={sf.primaryBtn}
              style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 88%, white) 100%)',
              }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nuovo contatto
            </Link>
          </div>
        }
      />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[420px,1fr] lg:items-start">
        <div className="lg:sticky lg:top-5">
          <ContactsFilters
            locationId={locationId}
            categories={categories}
            allTags={allTags}
            gestoreOptions={gestoreOptions}
            activeCategory={filters.category}
            activeTag={filters.tag}
            activeGestore={filters.gestore}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            scadenzaFrom={filters.scadenzaFrom}
            scadenzaTo={filters.scadenzaTo}
            search={filters.search}
            onFilterChange={handleFilterChange}
          />
        </div>

        <div className={`min-w-0 ${isLoading || isFilterPending ? 'opacity-60 transition-opacity' : ''}`}>
          {isLoading && !data ? (
            <div className={sf.emptyPanel}>
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
              <p className="mt-4 text-sm font-medium text-gray-500">Caricamento contatti…</p>
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
        </div>
      </div>

      {hasFilters && !isLoading && contacts.length === 0 && (
        <div className="text-center">
          <button
            onClick={() => handleFilterChange({ category: null, tag: null, gestore: null, dateFrom: null, dateTo: null, scadenzaFrom: null, scadenzaTo: null, search: null })}
            className="text-xs font-semibold text-brand underline-offset-4 hover:underline"
          >
            Rimuovi filtri
          </button>
        </div>
      )}
    </div>
  )
}
