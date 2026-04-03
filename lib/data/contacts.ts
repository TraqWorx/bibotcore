/**
 * Contacts data access layer — reads from Supabase cache.
 * Falls back to GHL API if cache is empty and triggers background sync.
 */

import { createAdminClient } from '@/lib/supabase-server'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'
import {
  type CustomFieldDef,
  parseCategoriaValue,
} from '@/lib/utils/categoryFields'

const GHL_BASE = 'https://services.leadconnectorhq.com'

export type CachedContact = {
  ghl_id: string
  location_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  company_name: string | null
  address1: string | null
  city: string | null
  tags: string[]
  assigned_to: string | null
  date_added: string | null
  last_activity: string | null
  raw?: Record<string, unknown> | null
}

export type ContactCustomFieldValue = {
  field_id: string
  field_key: string | null
  value: string | null
}

interface ListContactsOptions {
  categoryLabels?: string[]
  categoriaFieldId?: string | null
  tag?: string | null
  gestoreFieldId?: string | null
  gestore?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  scadenzaFieldIds?: string[]
  scadenzaFrom?: string | null
  scadenzaTo?: string | null
  search?: string | null
}

/**
 * List contacts from Supabase cache.
 * If cache is empty, falls back to GHL API.
 */
export async function listContacts(
  locationId: string,
  options: ListContactsOptions = {},
): Promise<{ contacts: CachedContact[]; fromCache: boolean }> {
  const cached = await fetchContactsFromCache(locationId, options)

  // If cache has data, return it immediately
  if (cached.length > 0) {
    return { contacts: cached, fromCache: true }
  }

  // Check if cache was synced but just has no matches for this filter
  const sb = createAdminClient()
  const { count } = await sb
    .from('cached_contacts')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId)

  if (count && count > 0) {
    // Cache exists, filters just returned nothing
    return { contacts: [], fromCache: true }
  }

  // Cache is truly empty — fall back to GHL
  return { contacts: await fetchContactsFromGhl(locationId, options), fromCache: false }
}

/** Fetch a single contact from cache */
export async function getContact(
  locationId: string,
  contactGhlId: string,
): Promise<CachedContact | null> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('cached_contacts')
    .select('*')
    .eq('location_id', locationId)
    .eq('ghl_id', contactGhlId)
    .single()
  return data ?? null
}

/** Get custom field values for a contact */
export async function getContactCustomFields(
  locationId: string,
  contactGhlId: string,
): Promise<ContactCustomFieldValue[]> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('cached_contact_custom_fields')
    .select('field_id, field_key, value')
    .eq('location_id', locationId)
    .eq('contact_ghl_id', contactGhlId)
  return data ?? []
}

/** Get cached custom field definitions for a location */
export async function getCustomFieldDefs(locationId: string): Promise<CustomFieldDef[]> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('cached_custom_fields')
    .select('*')
    .eq('location_id', locationId)

  if (!data || data.length === 0) return []
  return data.map((f) => ({
    id: f.field_id,
    name: f.name ?? '',
    fieldKey: f.field_key ?? f.field_id,
    dataType: f.data_type ?? 'TEXT',
    placeholder: f.placeholder ?? undefined,
    picklistOptions: f.picklist_options ?? [],
  }))
}

// ── Lean column list (no raw JSONB on list queries) ──────────

const CONTACT_LIST_COLUMNS = 'ghl_id, location_id, first_name, last_name, email, phone, company_name, address1, city, tags, assigned_to, date_added, last_activity'

// ── Cache reads ──────────────────────────────────────────────

async function fetchContactsFromCache(
  locationId: string,
  options: ListContactsOptions,
): Promise<CachedContact[]> {
  const sb = createAdminClient()
  let query = sb
    .from('cached_contacts')
    .select(CONTACT_LIST_COLUMNS)
    .eq('location_id', locationId)
    .order('date_added', { ascending: false })

  // Text search on name/email/phone
  if (options.search) {
    const s = `%${options.search}%`
    query = query.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},phone.ilike.${s}`)
  }

  // Tag filter
  if (options.tag) {
    const tags = options.tag.split(',').map((t) => t.trim()).filter(Boolean)
    for (const tag of tags) {
      query = query.contains('tags', [tag])
    }
  }

  // Date range on date_added
  if (options.dateFrom) {
    query = query.gte('date_added', new Date(options.dateFrom + 'T00:00:00.000Z').toISOString())
  }
  if (options.dateTo) {
    query = query.lte('date_added', new Date(options.dateTo + 'T23:59:59.999Z').toISOString())
  }

  // Fire all filter queries in PARALLEL with the main contacts query
  const needsCategory = options.categoryLabels && options.categoryLabels.length > 0 && options.categoriaFieldId
  const needsGestore = options.gestore && options.gestoreFieldId
  const needsScadenza = options.scadenzaFieldIds && options.scadenzaFieldIds.length > 0 && (options.scadenzaFrom || options.scadenzaTo)

  const [contactsResult, categoryResult, gestoreResult, scadenzaResult] = await Promise.all([
    query,
    needsCategory
      ? sb.from('cached_contact_custom_fields').select('contact_ghl_id, value').eq('location_id', locationId).eq('field_id', options.categoriaFieldId!)
      : null,
    needsGestore
      ? sb.from('cached_contact_custom_fields').select('contact_ghl_id').eq('location_id', locationId).eq('field_id', options.gestoreFieldId!).eq('value', options.gestore!)
      : null,
    needsScadenza
      ? sb.from('cached_contact_custom_fields').select('contact_ghl_id, value').eq('location_id', locationId).in('field_id', options.scadenzaFieldIds!)
      : null,
  ])

  let result: CachedContact[] = (contactsResult.data ?? []) as CachedContact[]

  // Apply category filter
  if (needsCategory && categoryResult) {
    const contactCatMap = new Map<string, string[]>()
    for (const row of categoryResult.data ?? []) {
      contactCatMap.set(row.contact_ghl_id, parseCategoriaValue(row.value ?? ''))
    }
    result = result.filter((c) => {
      const cats = contactCatMap.get(c.ghl_id) ?? []
      return options.categoryLabels!.some((label) => cats.includes(label))
    })
  }

  // Apply gestore filter
  if (needsGestore && gestoreResult) {
    const matchIds = new Set((gestoreResult.data ?? []).map((r) => r.contact_ghl_id))
    result = result.filter((c) => matchIds.has(c.ghl_id))
  }

  // Apply scadenza filter
  if (needsScadenza && scadenzaResult) {
    const matchIds = new Set<string>()
    for (const row of scadenzaResult.data ?? []) {
      if (!row.value) continue
      const val = normalizeDateValue(row.value)
      if (options.scadenzaFrom && val < options.scadenzaFrom) continue
      if (options.scadenzaTo && val > options.scadenzaTo) continue
      matchIds.add(row.contact_ghl_id)
    }
    result = result.filter((c) => matchIds.has(c.ghl_id))
  }

  return result
}

function normalizeDateValue(raw: string): string {
  if (raw.includes('T')) return raw.slice(0, 10)
  if (raw.includes('/')) {
    const [d, m, y] = raw.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  if (raw.match(/^\d{2}-\d{2}-\d{4}$/)) {
    const [d, m, y] = raw.split('-')
    return `${y}-${m}-${d}`
  }
  return raw.slice(0, 10)
}

// ── GHL fallback ─────────────────────────────────────────────

async function fetchContactsFromGhl(
  locationId: string,
  options: ListContactsOptions,
): Promise<CachedContact[]> {
  let token: string
  try {
    token = await getGhlTokenForLocation(locationId)
  } catch {
    return []
  }

  const allContacts: Record<string, unknown>[] = []
  for (let page = 1; page <= 5; page++) {
    try {
      const res = await fetch(`${GHL_BASE}/contacts/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationId,
          pageLimit: 100,
          page,
          ...(options.search ? { query: options.search } : {}),
        }),
        cache: 'no-store',
      })
      if (!res.ok) break
      const data = await res.json()
      const contacts = data?.contacts ?? []
      allContacts.push(...contacts)
      if (contacts.length < 100) break
    } catch {
      break
    }
  }

  // Map to CachedContact shape for consistent interface
  return allContacts.map((c) => ({
    ghl_id: c.id as string,
    location_id: locationId,
    first_name: (c.firstName as string) ?? null,
    last_name: (c.lastName as string) ?? null,
    email: (c.email as string) ?? null,
    phone: (c.phone as string) ?? null,
    company_name: (c.companyName as string) ?? null,
    address1: (c.address1 as string) ?? null,
    city: (c.city as string) ?? null,
    tags: Array.isArray(c.tags) ? c.tags : [],
    assigned_to: (c.assignedTo as string) ?? null,
    date_added: (c.dateAdded as string) ?? null,
    last_activity: (c.lastActivity as string) ?? null,
    raw: c,
  }))
}
