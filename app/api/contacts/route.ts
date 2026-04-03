import { NextRequest, NextResponse } from 'next/server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { createAdminClient } from '@/lib/supabase-server'
import { parseCategoriaValue } from '@/lib/utils/categoryFields'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

/**
 * GET /api/contacts — paginated contacts with filters.
 * Returns lean data (no raw JSONB) + custom field values.
 * Query params: locationId, page, search, tag, category, categoriaFieldId,
 *   gestoreFieldId, gestore, dateFrom, dateTo, scadenzaFieldIds, scadenzaFrom, scadenzaTo
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const locationId = sp.get('locationId')
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const access = await getLocationAccess(req, locationId)
  if (access.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (access.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const page = Math.max(1, parseInt(sp.get('page') ?? '1'))
  const search = sp.get('search') ?? null
  const tag = sp.get('tag') ?? null
  const categoryLabels = sp.get('categoryLabels')?.split(',').filter(Boolean) ?? []
  const categoriaFieldId = sp.get('categoriaFieldId') ?? null
  const gestoreFieldId = sp.get('gestoreFieldId') ?? null
  const gestore = sp.get('gestore') ?? null
  const dateFrom = sp.get('dateFrom') ?? null
  const dateTo = sp.get('dateTo') ?? null
  const scadenzaFieldIds = sp.get('scadenzaFieldIds')?.split(',').filter(Boolean) ?? []
  const scadenzaFrom = sp.get('scadenzaFrom') ?? null
  const scadenzaTo = sp.get('scadenzaTo') ?? null

  const sb = createAdminClient()
  const offset = (page - 1) * PAGE_SIZE

  // Build main contacts query
  let query = sb
    .from('cached_contacts')
    .select('ghl_id, first_name, last_name, email, phone, company_name, address1, city, tags, assigned_to, date_added, last_activity', { count: 'exact' })
    .eq('location_id', locationId)
    .order('date_added', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (search) {
    const s = `%${search}%`
    query = query.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},phone.ilike.${s}`)
  }
  if (tag) {
    for (const t of tag.split(',').map((t) => t.trim()).filter(Boolean)) {
      query = query.contains('tags', [t])
    }
  }
  if (dateFrom) query = query.gte('date_added', new Date(dateFrom + 'T00:00:00.000Z').toISOString())
  if (dateTo) query = query.lte('date_added', new Date(dateTo + 'T23:59:59.999Z').toISOString())

  // Run contacts query + filter queries in parallel
  const needsCategory = categoryLabels.length > 0 && categoriaFieldId
  const needsGestore = gestore && gestoreFieldId
  const needsScadenza = scadenzaFieldIds.length > 0 && (scadenzaFrom || scadenzaTo)

  const [contactsResult, categoryResult, gestoreResult, scadenzaResult] = await Promise.all([
    query,
    needsCategory
      ? sb.from('cached_contact_custom_fields').select('contact_ghl_id, value').eq('location_id', locationId).eq('field_id', categoriaFieldId!)
      : null,
    needsGestore
      ? sb.from('cached_contact_custom_fields').select('contact_ghl_id').eq('location_id', locationId).eq('field_id', gestoreFieldId!).eq('value', gestore!)
      : null,
    needsScadenza
      ? sb.from('cached_contact_custom_fields').select('contact_ghl_id, value').eq('location_id', locationId).in('field_id', scadenzaFieldIds)
      : null,
  ])

  let contacts = contactsResult.data ?? []
  let totalCount = contactsResult.count ?? 0

  // Apply custom field filters (post-query since they're EAV joins)
  if (needsCategory && categoryResult) {
    const catMap = new Map<string, string[]>()
    for (const r of categoryResult.data ?? []) catMap.set(r.contact_ghl_id, parseCategoriaValue(r.value ?? ''))
    contacts = contacts.filter((c) => {
      const cats = catMap.get(c.ghl_id) ?? []
      return categoryLabels.some((l) => cats.includes(l))
    })
    totalCount = contacts.length // Adjusted count after filter
  }
  if (needsGestore && gestoreResult) {
    const ids = new Set((gestoreResult.data ?? []).map((r) => r.contact_ghl_id))
    contacts = contacts.filter((c) => ids.has(c.ghl_id))
    totalCount = contacts.length
  }
  if (needsScadenza && scadenzaResult) {
    const ids = new Set<string>()
    for (const r of scadenzaResult.data ?? []) {
      if (!r.value) continue
      const val = r.value.includes('T') ? r.value.slice(0, 10) : r.value
      if (scadenzaFrom && val < scadenzaFrom) continue
      if (scadenzaTo && val > scadenzaTo) continue
      ids.add(r.contact_ghl_id)
    }
    contacts = contacts.filter((c) => ids.has(c.ghl_id))
    totalCount = contacts.length
  }

  // Fetch custom field values for these contacts
  const ghlIds = contacts.map((c) => c.ghl_id)
  const { data: cfValues } = ghlIds.length > 0
    ? await sb.from('cached_contact_custom_fields')
        .select('contact_ghl_id, field_id, value')
        .eq('location_id', locationId)
        .in('contact_ghl_id', ghlIds)
    : { data: [] }

  // Build custom fields map
  const cfMap: Record<string, { id: string; value: string }[]> = {}
  for (const r of cfValues ?? []) {
    if (!r.value) continue
    if (!cfMap[r.contact_ghl_id]) cfMap[r.contact_ghl_id] = []
    cfMap[r.contact_ghl_id].push({ id: r.field_id, value: r.value })
  }

  // Build response contacts with customFields attached
  const result = contacts.map((c) => ({
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
    customFields: cfMap[c.ghl_id] ?? [],
  }))

  return NextResponse.json({
    contacts: result,
    total: totalCount,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
  })
}
