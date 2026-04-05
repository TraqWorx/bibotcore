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
  demoContacts?: Contact[]
  demoMode?: boolean
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

  const { data, isLoading } = useSWR(props.demoContacts ? null : apiUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  const demoFilteredContacts = useMemo(() => {
    if (!props.demoContacts) return []
    return props.demoContacts.filter((contact) => {
      const search = (filters.search ?? '').trim().toLowerCase()
      if (search) {
        const hay = [
          String(contact.contactName ?? ''),
          String(contact.phone ?? ''),
          String(contact.email ?? ''),
          String(contact.companyName ?? ''),
        ].join(' ').toLowerCase()
        if (!hay.includes(search)) return false
      }

      if (filters.tag) {
        const selected = filters.tag.split(',').filter(Boolean)
        const tags = Array.isArray(contact.tags) ? (contact.tags as string[]) : []
        if (!selected.every((tag) => tags.includes(tag))) return false
      }

      if (categoryLabels.length > 0) {
        const raw = Array.isArray(contact.customFields)
          ? (contact.customFields as { id: string; value?: unknown; field_value?: unknown; fieldValue?: unknown }[])
              .find((field) => field.id === categoriaFieldId)
          : null
        const value = raw ? String(raw.value ?? raw.field_value ?? raw.fieldValue ?? '') : ''
        const cats = value.split(',').map((s) => s.trim()).filter(Boolean)
        if (!categoryLabels.some((label) => cats.includes(label))) return false
      }

      return true
    })
  }, [props.demoContacts, filters.search, filters.tag, categoryLabels, categoriaFieldId])

  const contacts: Contact[] = props.demoContacts ?? data?.contacts ?? []
  const visibleContacts: Contact[] = props.demoContacts ? demoFilteredContacts : contacts
  const total: number = props.demoContacts ? visibleContacts.length : data?.total ?? 0
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
              <span className="font-semibold text-[var(--foreground)]">{total}</span> in elenco
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
            {props.demoMode ? (
              <span
                className={sf.primaryBtn}
                style={{ backgroundColor: 'var(--brand)', borderColor: 'var(--brand)', opacity: 0.92, cursor: 'default' }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nuovo contatto
              </span>
            ) : (
              <Link
                href={`/designs/simfonia/contacts/new${q}`}
                className={sf.primaryBtn}
                style={{ backgroundColor: 'var(--brand)', borderColor: 'var(--brand)' }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nuovo contatto
              </Link>
            )}
          </div>
        }
      />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[420px,1fr] lg:items-start">
        <div className="lg:sticky lg:top-5 z-40 overflow-visible">
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
          {isLoading && !data && !props.demoContacts ? (
            <div className={sf.emptyPanel}>
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
              <p className="mt-4 text-sm font-medium text-[var(--shell-muted)]">Caricamento contatti…</p>
            </div>
          ) : (
            <ContactsList
              contacts={visibleContacts}
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
