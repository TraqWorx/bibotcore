import Link from 'next/link'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'
import { getClosedDays } from '../settings/_actions'
import {
  discoverCategories,
  getCategoriaField,
  getProviderField,
  getSwitchOutField,
  parseCategoriaValue,
  type CustomFieldDef,
} from '@/lib/utils/categoryFields'

const BASE_URL = 'https://services.leadconnectorhq.com'

// ─── Working days helpers ────────────────────────────────────────────────────

function countWorkingDays(start: Date, end: Date, closedDays: Set<string> = new Set()): number {
  let count = 0
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)
  while (cur <= endDay) {
    const d = cur.getDay()
    const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    if (d !== 0 && d !== 6 && !closedDays.has(iso)) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function getWorkingDayStats(closedDays: Set<string> = new Set()) {
  const now = new Date()
  const year = now.getFullYear()
  const jan1 = new Date(year, 0, 1)
  const dec31 = new Date(year, 11, 31)
  const passed = countWorkingDays(jan1, now, closedDays)
  const total = countWorkingDays(jan1, dec31, closedDays)
  const remaining = total - passed
  return { passed, remaining, total, pct: Math.round((passed / total) * 100) }
}

function getMonthWorkingDayStats(closedDays: Set<string> = new Set()) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const passed = countWorkingDays(monthStart, now, closedDays)
  const total = countWorkingDays(monthStart, monthEnd, closedDays)
  return { passed, total, pct: total > 0 ? Math.round((passed / total) * 100) : 0 }
}

// ─── GHL helpers ─────────────────────────────────────────────────────────────

interface GhlUser {
  id: string
  name: string
  firstName?: string
  lastName?: string
  email: string
  roles?: { role?: string }
}

async function ghlGet(path: string, token: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
    next: { revalidate: 300 },
  })
  if (!res.ok) return null
  return res.json()
}

async function ghlSearch(
  locationId: string,
  token: string,
  filters: { field: string; operator: string; value: string }[],
  pageLimit = 100,
): Promise<{ total: number; contacts: Record<string, unknown>[] }> {
  try {
    const res = await fetch(`${BASE_URL}/contacts/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, pageLimit, filters }),
      cache: 'no-store',
    })
    if (!res.ok) return { total: 0, contacts: [] }
    const data = await res.json()
    const contacts = data?.contacts ?? []
    const total = data?.total ?? contacts.length
    return { total, contacts }
  } catch {
    return { total: 0, contacts: [] }
  }
}

/** Fetch ALL contacts matching a filter (paginated up to 500) — returns full contact objects with customFields */
async function ghlSearchAll(
  locationId: string,
  token: string,
  filters: { field: string; operator: string; value: string }[],
): Promise<Record<string, unknown>[]> {
  const allContacts: Record<string, unknown>[] = []
  for (let page = 1; page <= 5; page++) {
    try {
      const res = await fetch(`${BASE_URL}/contacts/search`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, pageLimit: 100, page, ...(filters.length > 0 ? { filters } : {}) }),
        cache: 'no-store',
      })
      if (!res.ok) break
      const data = await res.json()
      const contacts: Record<string, unknown>[] = data?.contacts ?? []
      allContacts.push(...contacts)
      if (contacts.length < 100) break
    } catch { break }
  }
  return allContacts
}

async function getContactsCount(locationId: string, token: string): Promise<number> {
  const data = await ghlGet(`/contacts/?locationId=${locationId}&limit=1`, token)
  return data?.total ?? data?.meta?.total ?? 0
}

async function getGhlUsers(locationId: string, token: string): Promise<GhlUser[]> {
  const data = await ghlGet(`/users/?locationId=${locationId}`, token)
  return (data?.users ?? []) as GhlUser[]
}

async function getContactsForUser(locationId: string, token: string, userId: string): Promise<number> {
  const { total } = await ghlSearch(locationId, token, [{ field: 'assignedTo', operator: 'eq', value: userId }])
  return total
}

/** Read a custom field value from a contact's customFields array */
function getCustomFieldValue(contact: Record<string, unknown>, fieldId: string): string {
  const cfArray = contact.customFields
  if (!Array.isArray(cfArray)) return ''
  const field = cfArray.find((f: Record<string, unknown>) => f.id === fieldId)
  if (!field) return ''
  const val = (field as Record<string, unknown>).value ?? (field as Record<string, unknown>).field_value ?? (field as Record<string, unknown>).fieldValue ?? ''
  return String(val).trim()
}

/** Count contacts by provider value for a category */
function countByProvider(
  contacts: Record<string, unknown>[],
  providerFieldId: string,
): { provider: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const contact of contacts) {
    const val = getCustomFieldValue(contact, providerFieldId) || 'Non specificato'
    counts.set(val, (counts.get(val) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([provider, count]) => ({ provider, count }))
    .sort((a, b) => b.count - a.count)
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
      picklistOptions: cf.picklistOptions,
    }))
  } catch {
    return []
  }
}

// ─── Category colors ────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { border: string; accent: string; bg: string }> = {
  telefonia:       { border: 'border-blue-200', accent: 'text-blue-700', bg: 'bg-blue-50' },
  energia:         { border: 'border-amber-200', accent: 'text-amber-700', bg: 'bg-amber-50' },
  connettivita:    { border: 'border-green-200', accent: 'text-green-700', bg: 'bg-green-50' },
  intrattenimento: { border: 'border-purple-200', accent: 'text-purple-700', bg: 'bg-purple-50' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CrmDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const locationId = await getActiveLocation(sp).catch(() => null)

  if (!locationId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">Nessuna location connessa. Riconnetti il tuo account GHL.</p>
      </div>
    )
  }

  const supabase = createAdminClient()
  const authClient = await createAuthClient()
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data: { user: authUser } } = await authClient.auth.getUser()
  const userEmail = authUser?.email?.toLowerCase() ?? ''

  const { data: profile } = authUser
    ? await supabase.from('profiles').select('role').eq('id', authUser.id).single()
    : { data: null }
  const isSuperAdmin = profile?.role === 'super_admin'

  const [token, settingsRes, { data: gareRows }, closedDaysArr] = await Promise.all([
    getGhlTokenForLocation(locationId).catch(() => null),
    supabase.from('location_settings').select('target_annuale').eq('location_id', locationId).single(),
    supabase.from('gare_mensili').select('categoria, obiettivo, tag').eq('location_id', locationId).eq('month', currentMonth).order('categoria'),
    getClosedDays(locationId),
  ])

  const closedDays = new Set(closedDaysArr)

  const targetAnnuale: number = settingsRes.data?.target_annuale ?? 1900

  if (!token) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">Token GHL non trovato per questa location.</p>
      </div>
    )
  }

  const ghlUsers = await getGhlUsers(locationId, token)
  const currentGhlUser = ghlUsers.find((u) => u.email.toLowerCase() === userEmail)
  const isGhlAdmin = currentGhlUser?.roles?.role === 'admin'
  const isAdmin = isSuperAdmin || isGhlAdmin

  const currentGhlUserId = currentGhlUser?.id
  const [totalContacts, customFields] = await Promise.all([
    !isAdmin && currentGhlUserId
      ? getContactsForUser(locationId, token, currentGhlUserId)
      : getContactsCount(locationId, token),
    fetchCustomFields(token, locationId),
  ])

  // Discover categories from the Categoria dropdown field
  const categories = discoverCategories(customFields)
  const categoriaField = getCategoriaField(customFields)
  const categoriaFieldId = categoriaField?.id ?? null
  const switchOutField = getSwitchOutField(customFields)
  const switchOutFieldId = switchOutField?.id ?? null

  // ─── Fetch ALL contacts once, then group by Categoria custom field ──────
  const allContacts = await ghlSearchAll(locationId, token, [])

  // Count Switch Out contacts
  const switchOutCount = switchOutFieldId
    ? allContacts.filter((c) => getCustomFieldValue(c, switchOutFieldId) === 'true').length
    : 0

  const categoryData = categories.map((cat) => {
    // Filter by Categoria custom field value (not tags)
    // Supports comma-separated multi-category values: contact counts in EACH matching category
    const contacts = categoriaFieldId
      ? allContacts.filter((c) => parseCategoriaValue(getCustomFieldValue(c, categoriaFieldId)).includes(cat.label))
      : []

    const providerField = getProviderField(customFields, cat.label)
    const providerCounts = providerField
      ? countByProvider(contacts, providerField.id)
      : []

    // Build full gestori list from picklist options, merging counts
    const countMap = new Map(providerCounts.map((p) => [p.provider, p.count]))
    const gestori = providerField?.picklistOptions
      ? providerField.picklistOptions.map((opt) => ({
          provider: opt,
          count: countMap.get(opt) ?? 0,
        }))
      : providerCounts

    return {
      ...cat,
      total: contacts.length,
      providers: gestori,
    }
  })

  // Per-operatore contact counts (admin only)
  const operatorCounts: { name: string; initials: string; count: number; isAdmin: boolean; categoryCounts: Record<string, number> }[] = []
  if (isAdmin && ghlUsers.length > 0) {
    const nonAdminUsers = ghlUsers.filter((u) => u.roles?.role !== 'admin')
    const adminUsers = ghlUsers.filter((u) => u.roles?.role === 'admin')

    const nonAdminCounts = await Promise.all(
      nonAdminUsers.map((u) => getContactsForUser(locationId, token, u.id))
    )
    const categoryLabels = categories.map((c) => c.label)
    // For per-user category counts, fetch assigned contacts and count by Categoria custom field
    const nonAdminUserContacts = await Promise.all(
      nonAdminUsers.map(async (u) => {
        const { contacts } = await ghlSearch(locationId, token, [{ field: 'assignedTo', operator: 'eq', value: u.id }])
        return contacts
      })
    )
    const nonAdminTagCounts = nonAdminUserContacts.map((contacts) => {
      const tagMap: Record<string, number> = {}
      for (const label of categoryLabels) {
        tagMap[label] = categoriaFieldId
          ? contacts.filter((c) => parseCategoriaValue(getCustomFieldValue(c, categoriaFieldId)).includes(label)).length
          : 0
      }
      return tagMap
    })

    const adminTagMap: Record<string, number> = {}
    for (const cd of categoryData) adminTagMap[cd.label] = cd.total

    for (const u of adminUsers) {
      operatorCounts.push({
        name: u.name,
        initials: u.name?.charAt(0)?.toUpperCase() ?? '?',
        count: totalContacts,
        isAdmin: true,
        categoryCounts: adminTagMap,
      })
    }
    nonAdminUsers.forEach((u, i) => {
      operatorCounts.push({
        name: u.name,
        initials: u.name?.charAt(0)?.toUpperCase() ?? '?',
        count: nonAdminCounts[i],
        isAdmin: false,
        categoryCounts: nonAdminTagCounts[i],
      })
    })
  }

  // Gare data (admin only)
  const wd = getWorkingDayStats(closedDays)
  const mwd = getMonthWorkingDayStats(closedDays)
  let gareData: {
    categoria: string; obiettivo: number; attivato: number;
    remaining: number; pctRaggiunta: number; isOnTrack: boolean
  }[] = []

  if (isAdmin && gareRows && gareRows.length > 0) {
    // Collect all provider field IDs for gestore-based counting
    const providerFieldIds = categories
      .map((cat) => getProviderField(customFields, cat.label)?.id)
      .filter((id): id is string => !!id)

    // Count contacts per gestore value for the current month
    // We search ALL contacts created this month, then count per gestore value
    const monthStart = new Date(currentMonth + 'T00:00:00.000Z')
    const monthEnd = new Date(monthStart)
    monthEnd.setMonth(monthEnd.getMonth() + 1)

    const monthContacts = await ghlSearchAll(locationId, token, [
      { field: 'dateAdded', operator: 'GTE', value: monthStart.toISOString() },
      { field: 'dateAdded', operator: 'LTE', value: monthEnd.toISOString() },
    ])

    // Count how many contacts have each gestore value across all provider fields
    const gestoreCountMap: Record<string, number> = {}
    for (const contact of monthContacts) {
      for (const fieldId of providerFieldIds) {
        const val = getCustomFieldValue(contact, fieldId).toLowerCase()
        if (val) {
          gestoreCountMap[val] = (gestoreCountMap[val] ?? 0) + 1
        }
      }
    }

    gareData = gareRows.map((g: { categoria: string; obiettivo: number; tag: string }) => {
      const attivato = gestoreCountMap[g.tag] ?? 0
      const pctRaggiunta = g.obiettivo > 0 ? (attivato / g.obiettivo) * 100 : 0
      return {
        categoria: g.categoria,
        obiettivo: g.obiettivo,
        attivato,
        remaining: g.obiettivo - attivato,
        pctRaggiunta,
        isOnTrack: pctRaggiunta >= mwd.pct,
      }
    })
  }

  // Target annuale performance (admin only)
  const contratti = totalContacts
  const pctContratti = targetAnnuale > 0 ? (contratti / targetAnnuale) * 100 : 0
  const pctTempo = wd.pct
  const diff = pctContratti - pctTempo
  const perfStatus: 'green' | 'yellow' | 'red' =
    diff > 2 ? 'green' : diff >= -2 ? 'yellow' : 'red'
  const perfConfig = {
    green:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', label: 'In Target' },
    yellow: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', label: 'Attenzione' },
    red:    { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', label: 'Sotto Target' },
  }[perfStatus]

  const q = `?locationId=${locationId}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {isAdmin ? 'Panoramica operativa' : `I tuoi risultati`} — {now.getFullYear()}
          </p>
        </div>
        <Link
          href={`/designs/simfonia/contacts/new${q}`}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-black shadow-sm transition-all hover:opacity-90"
          style={{ background: '#00F0FF' }}
        >
          + Nuovo Contatto
        </Link>
      </div>

      {/* ═══ TOP ROW: Overview ═══ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Contatti Totali</p>
          <p className="mt-2 text-3xl font-black text-gray-900">{totalContacts.toLocaleString('it-IT')}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Operatori</p>
          <p className="mt-2 text-3xl font-black text-gray-900">{ghlUsers.length}</p>
        </div>
        <div className={`rounded-2xl border p-5 shadow-sm ${switchOutCount > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'}`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            <span className="mr-1">&#x1F6A9;</span> Switch Out
          </p>
          <p className={`mt-2 text-3xl font-black ${switchOutCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {switchOutCount}
          </p>
        </div>
        <Link href={`/designs/simfonia/calendar${q}`} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Calendario</p>
          <p className="mt-2 text-sm font-medium text-gray-600">Vedi appuntamenti</p>
        </Link>
      </div>

      {/* ═══ TARGET ANNUALE (admin only) ═══ */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Target Annuale</p>
              <p className="mt-2 text-4xl font-black" style={{ color: '#2A00CC' }}>
                {targetAnnuale.toLocaleString('it-IT')}
              </p>
              <p className="mt-1 text-xs text-gray-400">contratti obiettivo</p>
              <Link href={`/designs/simfonia/settings${q}`} className="mt-2 inline-block text-xs font-medium underline" style={{ color: '#2A00CC' }}>
                Modifica
              </Link>
            </div>

            <div className="rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Contratti Chiusi</p>
              <p className="mt-2 text-4xl font-black" style={{ color: '#2A00CC' }}>
                {contratti.toLocaleString('it-IT')}
              </p>
              <p className="mt-1 text-xs text-gray-400">da inizio anno</p>
            </div>

            <div className="rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">% Raggiunta</p>
              <p className="mt-2 text-4xl font-black" style={{ color: '#2A00CC' }}>
                {pctContratti.toFixed(1)}%
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(pctContratti, 100)}%`,
                    background: perfStatus === 'green' ? '#16a34a' : perfStatus === 'yellow' ? '#d97706' : '#dc2626',
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">obiettivo: {pctTempo.toFixed(1)}% atteso</p>
            </div>
          </div>

          {/* Performance banner */}
          <div
            className="rounded-2xl border p-5"
            style={{ background: perfConfig.bg, borderColor: perfConfig.border }}
          >
            <div className="flex items-center justify-between">
              <div>
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
                  style={{ background: perfConfig.border, color: perfConfig.text }}
                >
                  {perfConfig.label}
                </span>
                <p className="mt-2 text-sm font-medium" style={{ color: perfConfig.text }}>
                  {pctContratti.toFixed(1)}% contratti vs {pctTempo}% tempo — differenza {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                </p>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-2xl font-bold" style={{ color: perfConfig.text }}>{wd.passed}</p>
                  <p className="text-xs" style={{ color: perfConfig.text, opacity: 0.7 }}>gg. passati</p>
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: perfConfig.text }}>{wd.remaining}</p>
                  <p className="text-xs" style={{ color: perfConfig.text, opacity: 0.7 }}>gg. rimanenti</p>
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: perfConfig.text }}>{wd.pct}%</p>
                  <p className="text-xs" style={{ color: perfConfig.text, opacity: 0.7 }}>anno trascorso</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ CATEGORY SECTIONS (4 cards with provider breakdown) ═══ */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Per Categoria</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {categoryData.map((cat) => {
            const style = CATEGORY_STYLES[cat.slug] ?? { border: 'border-gray-200', accent: 'text-gray-700', bg: 'bg-gray-50' }
            const pctOfTotal = totalContacts > 0 ? (cat.total / totalContacts) * 100 : 0
            return (
              <Link
                key={cat.slug}
                href={`/designs/simfonia/contacts${q}&category=${cat.slug}`}
                className={`group rounded-2xl border ${style.border} bg-white p-5 shadow-sm hover:shadow-md transition-all`}
              >
                <p className={`text-xs font-semibold uppercase tracking-widest ${style.accent}`}>{cat.label}</p>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className={`text-3xl font-black tabular-nums ${style.accent}`}>
                    {cat.total.toLocaleString('it-IT')}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-gray-300">contatti</span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all ${style.bg}`}
                    style={{ width: `${Math.min(pctOfTotal, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] tabular-nums text-gray-400">
                  {pctOfTotal.toFixed(1)}% del totale
                </p>

                {/* Provider breakdown */}
                {cat.providers.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-gray-100 pt-3">
                    {cat.providers.slice(0, 6).map((p) => (
                      <div key={p.provider} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 truncate mr-2">{p.provider}</span>
                        <span className="font-semibold tabular-nums text-gray-700">{p.count}</span>
                      </div>
                    ))}
                    {cat.providers.length > 6 && (
                      <p className="text-[10px] text-gray-400">+{cat.providers.length - 6} altri</p>
                    )}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </section>

      {/* ═══ PER OPERATORE (admin only) ═══ */}
      {isAdmin && operatorCounts.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Per Operatore</h2>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(operatorCounts.length, 3)}, minmax(0, 1fr))` }}>
            {operatorCounts.map((op) => (
              <div key={op.name} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{op.name}</p>
                    {op.isAdmin && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2A00CC]">Admin</span>
                    )}
                  </div>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: '#2A00CC' }}
                  >
                    {op.initials}
                  </span>
                </div>
                <p className="mt-3 text-3xl font-black text-gray-900">{op.count}</p>
                <p className="mt-1 text-xs text-gray-400">{op.isAdmin ? 'contatti totali' : 'contatti assegnati'}</p>
                {/* Category breakdown */}
                <div className="mt-3 space-y-1.5 border-t border-gray-50 pt-3">
                  {categories.map((cat) => {
                    const catCount = op.categoryCounts[cat.label] ?? 0
                    return (
                      <div key={cat.slug} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{cat.label}</span>
                        <span className="font-semibold tabular-nums text-gray-700">{catCount}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ STAFF PANORAMICA (admin only) ═══ */}
      {isAdmin && operatorCounts.filter((o) => !o.isAdmin).length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Staff Panoramica</h2>
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Collaboratore</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-widest text-gray-400">Contatti</th>
                  {categories.map((cat) => (
                    <th key={cat.slug} className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-widest text-gray-400">{cat.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {operatorCounts.filter((o) => !o.isAdmin).map((op) => (
                  <tr key={op.name} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: '#2A00CC' }}
                        >
                          {op.initials}
                        </span>
                        <span className="font-medium text-gray-800">{op.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-bold tabular-nums text-gray-900">{op.count}</td>
                    {categories.map((cat) => (
                      <td key={cat.slug} className="px-5 py-3 text-right tabular-nums text-gray-600">{op.categoryCounts[cat.label] ?? 0}</td>
                    ))}
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-gray-200 bg-gray-50/80 font-bold">
                  <td className="px-5 py-3 text-gray-700">Totale Staff</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-900">
                    {operatorCounts.filter((o) => !o.isAdmin).reduce((s, o) => s + o.count, 0)}
                  </td>
                  {categories.map((cat) => (
                    <td key={cat.slug} className="px-5 py-3 text-right tabular-nums text-gray-900">
                      {operatorCounts.filter((o) => !o.isAdmin).reduce((s, o) => s + (o.categoryCounts[cat.label] ?? 0), 0)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ═══ GARE MENSILI (admin only) ═══ */}
      {isAdmin && gareData.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">
              Gare — {now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
            </h2>
            <Link href={`/designs/simfonia/settings${q}`} className="text-xs font-medium underline" style={{ color: '#2A00CC' }}>
              Modifica obiettivi
            </Link>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(gareData.length, 4)}, minmax(0, 1fr))` }}>
            {gareData.map((g) => {
              const pctClamped = Math.min(g.pctRaggiunta, 100)
              const barColor = g.isOnTrack ? '#16a34a' : '#dc2626'
              return (
                <div
                  key={g.categoria}
                  className="rounded-2xl border bg-white p-5 shadow-sm"
                  style={{ borderColor: g.isOnTrack ? '#bbf7d0' : '#fecaca' }}
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 capitalize">{g.categoria}</p>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-3xl font-black tabular-nums text-gray-900">{g.attivato}</span>
                    <span className="text-lg font-semibold tabular-nums text-gray-300">/ {g.obiettivo}</span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pctClamped}%`, background: barColor }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                      style={{
                        background: g.isOnTrack ? '#f0fdf4' : '#fef2f2',
                        color: g.isOnTrack ? '#166534' : '#991b1b',
                      }}
                    >
                      {g.pctRaggiunta.toFixed(1)}%
                    </span>
                    <span className="text-[11px] tabular-nums text-gray-400">
                      {g.remaining > 0 ? `${g.remaining} rimanenti` : 'Completato'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}
