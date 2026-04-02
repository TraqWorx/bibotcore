import { NextRequest, NextResponse } from 'next/server'
import { assertLocationAccess } from '@/lib/auth/assertLocationAccess'
import { createServerClient } from '@supabase/ssr'
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
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const sb = createAdminClient()
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  // ALL queries in one parallel batch
  const [
    { data: profile },
    { count: totalContacts },
    { data: allCfValues },
    customFields,
    { data: ghlUsers },
    settingsRes,
    { data: gareRows },
    { data: closedDaysData },
  ] = await Promise.all([
    sb.from('profiles').select('role').eq('id', user.id).single(),
    sb.from('cached_contacts').select('*', { count: 'exact', head: true }).eq('location_id', locationId),
    sb.from('cached_contact_custom_fields').select('contact_ghl_id, field_id, value').eq('location_id', locationId),
    getCustomFieldDefs(locationId),
    sb.from('cached_ghl_users').select('ghl_id, name, first_name, last_name, email, role').eq('location_id', locationId),
    sb.from('location_settings').select('target_annuale').eq('location_id', locationId).single(),
    sb.from('gare_mensili').select('categoria, obiettivo, tag').eq('location_id', locationId).eq('month', currentMonth).order('categoria'),
    sb.from('location_settings').select('closed_days').eq('location_id', locationId).single(),
  ])

  const isSuperAdmin = profile?.role === 'super_admin'
  const currentGhlUser = (ghlUsers ?? []).find((u) => u.email?.toLowerCase() === user.email?.toLowerCase())
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

  // Check if AI module is enabled
  const { data: designSettings } = await sb
    .from('location_design_settings')
    .select('module_overrides')
    .eq('location_id', locationId)
    .maybeSingle()

  const moduleOverrides = (designSettings?.module_overrides ?? {}) as Record<string, { enabled?: boolean }>
  const aiEnabled = moduleOverrides.ai?.enabled !== false // default on

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
  })
}
