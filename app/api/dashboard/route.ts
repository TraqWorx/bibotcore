import { NextRequest, NextResponse } from 'next/server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { createAdminClient } from '@/lib/supabase-server'
import {
  discoverCategories,
  getCategoriaField,
  getProviderField,
  getFieldsForCategory,
  parseFieldCategory,
  isSwitchOutOn,
  parseCategoriaValue,
} from '@/lib/utils/categoryFields'
import { getCustomFieldDefs } from '@/lib/data/contacts'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dashboard — aggregated dashboard stats from cache.
 * Returns category breakdowns, operator counts, gare data — all pre-computed.
 */
export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const access = await getLocationAccess(req, locationId)
  if (access.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (access.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sb = createAdminClient()
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const trendStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  // ALL queries in one parallel batch
  const [
    { count: totalContacts },
    { data: recentContacts },
    { data: allCfValues },
    customFields,
    { data: ghlUsers },
    settingsRes,
    { data: gareRows },
    { data: closedDaysData },
    { data: designSettings },
    { data: calendarEvents },
  ] = await Promise.all([
    sb.from('cached_contacts').select('ghl_id', { count: 'exact', head: true }).eq('location_id', locationId),
    sb.from('cached_contacts')
      .select('date_added')
      .eq('location_id', locationId)
      .gte('date_added', trendStart.toISOString())
      .order('date_added', { ascending: true }),
    sb.from('cached_contact_custom_fields').select('contact_ghl_id, field_id, value').eq('location_id', locationId),
    getCustomFieldDefs(locationId),
    sb.from('cached_ghl_users').select('ghl_id, name, first_name, last_name, email, role').eq('location_id', locationId),
    sb.from('location_settings').select('target_annuale').eq('location_id', locationId).single(),
    sb.from('gare_mensili').select('categoria, obiettivo, tag').eq('location_id', locationId).eq('month', currentMonth).order('categoria'),
    sb.from('location_settings').select('closed_days').eq('location_id', locationId).single(),
    sb.from('location_design_settings').select('module_overrides').eq('location_id', locationId).maybeSingle(),
    sb.from('cached_calendar_events')
      .select('ghl_id, title, start_time, appointment_status, contact_ghl_id')
      .eq('location_id', locationId)
      .gte('start_time', monthStart.toISOString())
      .lt('start_time', monthEnd.toISOString())
      .order('start_time', { ascending: true }),
  ])

  const isSuperAdmin = access.isSuperAdmin
  const currentGhlUser = (ghlUsers ?? []).find((u) => u.email?.toLowerCase() === access.email.toLowerCase())
  const isGhlAdmin = currentGhlUser?.role === 'admin'
  const isAdmin = isSuperAdmin || isGhlAdmin

  // Build cfMap
  const cfMap = new Map<string, Map<string, string>>()
  for (const row of allCfValues ?? []) {
    if (!cfMap.has(row.contact_ghl_id)) cfMap.set(row.contact_ghl_id, new Map())
    if (row.value) cfMap.get(row.contact_ghl_id)!.set(row.field_id, row.value)
  }

  // Categories
  const categories = discoverCategories(customFields)
  const categoriaField = getCategoriaField(customFields)
  const categoriaFieldId = categoriaField?.id ?? null

  // Get all contact IDs for category counting
  const allContactIds = Array.from(cfMap.keys())

  // Switch Out fields per category
  const switchOutFieldForCat: Record<string, string> = {}
  for (const cat of categories) {
    const soField = getFieldsForCategory(customFields, cat.label).find((f) => {
      const { displayName } = parseFieldCategory(f.name)
      return displayName.toLowerCase().includes('switch out')
    })
    if (soField) switchOutFieldForCat[cat.label] = soField.id
  }

  const categoryData = categories.map((cat) => {
    const contactIds = categoriaFieldId
      ? allContactIds.filter((id) => parseCategoriaValue(cfMap.get(id)?.get(categoriaFieldId) ?? '').includes(cat.label))
      : []

    const providerField = getProviderField(customFields, cat.label)
    const providerCounts: { provider: string; count: number }[] = []
    if (providerField) {
      const counts = new Map<string, number>()
      for (const id of contactIds) {
        const val = cfMap.get(id)?.get(providerField.id) || 'Non specificato'
        counts.set(val, (counts.get(val) ?? 0) + 1)
      }
      const countMap = new Map(counts)
      if (providerField.picklistOptions) {
        for (const opt of providerField.picklistOptions) {
          providerCounts.push({ provider: opt, count: countMap.get(opt) ?? 0 })
        }
      } else {
        for (const [provider, count] of counts) providerCounts.push({ provider, count })
        providerCounts.sort((a, b) => b.count - a.count)
      }
    }

    const soFieldId = switchOutFieldForCat[cat.label]
    const switchOutCount = soFieldId
      ? contactIds.filter((id) => isSwitchOutOn(cfMap.get(id)?.get(soFieldId))).length
      : 0

    return {
      ...cat,
      total: contactIds.length,
      providers: providerCounts,
      switchOutCount,
    }
  })

  // Operators (admin only)
  const operators = isAdmin
    ? (ghlUsers ?? []).map((u) => {
        const name = u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.ghl_id
        const uIsAdmin = u.role === 'admin'
        // TODO: per-user counts would need assigned_to data — skip for now, send totals
        return {
          name,
          initials: name.charAt(0)?.toUpperCase() ?? '?',
          isAdmin: uIsAdmin,
        }
      })
    : []

  const moduleOverrides = (designSettings?.module_overrides ?? {}) as Record<string, { enabled?: boolean }>
  const aiEnabled = moduleOverrides.ai?.enabled !== false // default on

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const contactsTrend = Array.from({ length: daysInMonth }, (_, index) => {
    const d = index + 1
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return { date: iso, count: 0 }
  })
  const trendIndex = new Map(contactsTrend.map((item, index) => [item.date, index]))
  for (const row of recentContacts ?? []) {
    if (!row.date_added) continue
    const key = new Date(row.date_added).toISOString().slice(0, 10)
    const index = trendIndex.get(key)
    if (index !== undefined) contactsTrend[index].count += 1
  }

  const eventContactIds = [...new Set((calendarEvents ?? []).map((e) => e.contact_ghl_id).filter(Boolean))]
  const { data: calendarContacts } = eventContactIds.length > 0
    ? await sb.from('cached_contacts').select('ghl_id, first_name, last_name').eq('location_id', locationId).in('ghl_id', eventContactIds)
    : { data: [] }
  const contactNameById = new Map(
    (calendarContacts ?? []).map((c) => [c.ghl_id, [c.first_name, c.last_name].filter(Boolean).join(' ').trim()])
  )

  const appointmentPreview = (calendarEvents ?? []).map((event) => ({
    id: event.ghl_id,
    title: event.title ?? 'Appuntamento',
    startTime: event.start_time,
    status: event.appointment_status ?? 'new',
    contactName: event.contact_ghl_id ? (contactNameById.get(event.contact_ghl_id) || null) : null,
  }))

  return NextResponse.json({
    totalContacts: totalContacts ?? 0,
    operators: (ghlUsers ?? []).length,
    targetAnnuale: settingsRes.data?.target_annuale ?? 1900,
    categoryData,
    switchOutTotal: categoryData.reduce((s, c) => s + c.switchOutCount, 0),
    operatorList: operators,
    gareRows: gareRows ?? [],
    closedDays: closedDaysData?.closed_days ?? [],
    isAdmin,
    aiEnabled,
    contactsTrend,
    appointmentPreview,
  })
}
