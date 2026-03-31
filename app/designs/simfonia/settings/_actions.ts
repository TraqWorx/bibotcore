'use server'

import { createAdminClient } from '@/lib/supabase-server'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import { discoverCategories } from '@/lib/utils/categoryFields'

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export async function saveThemeOverrides(
  locationId: string,
  overrides: { primaryColor?: string; secondaryColor?: string; logoUrl?: string }
): Promise<{ error?: string }> {
  if (!locationId) return { error: 'Location ID mancante' }
  if (overrides.primaryColor && !HEX_RE.test(overrides.primaryColor))
    return { error: 'Colore primario non valido' }
  if (overrides.secondaryColor && !HEX_RE.test(overrides.secondaryColor))
    return { error: 'Colore secondario non valido' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('location_design_settings')
    .upsert(
      { location_id: locationId, theme_overrides: overrides, updated_at: new Date().toISOString() },
      { onConflict: 'location_id' }
    )

  if (error) return { error: error.message }
  return {}
}

export async function saveLocationSettings(
  locationId: string,
  targetAnnuale: number
): Promise<{ error?: string }> {
  if (!locationId) return { error: 'Location ID mancante' }
  if (!Number.isFinite(targetAnnuale) || targetAnnuale < 1) return { error: 'Target non valido' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('location_settings')
    .upsert(
      { location_id: locationId, target_annuale: targetAnnuale, updated_at: new Date().toISOString() },
      { onConflict: 'location_id' }
    )

  if (error) return { error: error.message }
  return {}
}

// ─── Contact Filters ────────────────────────────────────────────────────────

export async function getContactFilters(locationId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('location_settings')
    .select('contact_filters')
    .eq('location_id', locationId)
    .single()
  const filters = (data as { contact_filters?: string[] } | null)?.contact_filters
  return Array.isArray(filters) ? filters : []
}

export async function saveContactFilters(
  locationId: string,
  filters: string[]
): Promise<{ error?: string }> {
  if (!locationId) return { error: 'Location ID mancante' }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('location_settings')
    .upsert(
      { location_id: locationId, contact_filters: filters, updated_at: new Date().toISOString() },
      { onConflict: 'location_id' }
    )
  if (error) return { error: error.message }
  return {}
}

// ─── Contact Columns ─────────────────────────────────────────────────────────

export interface ContactColumn {
  key: string    // 'firstName', 'email', or custom field id
  label: string  // display name
  type: 'standard' | 'custom'
}

export async function getContactColumns(locationId: string, categoryKey?: string | null): Promise<ContactColumn[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('location_settings')
    .select('contact_columns')
    .eq('location_id', locationId)
    .single()
  const raw = (data as { contact_columns?: unknown } | null)?.contact_columns
  // Legacy format: plain array → treat as "_default"
  if (Array.isArray(raw)) {
    return categoryKey ? [] : (raw as ContactColumn[])
  }
  // New format: { "_default": [...], "Telefonia": [...] }
  if (raw && typeof raw === 'object') {
    const map = raw as Record<string, ContactColumn[]>
    const key = categoryKey ?? '_default'
    const cols = map[key]
    return Array.isArray(cols) ? cols : []
  }
  return []
}

export async function saveContactColumns(
  locationId: string,
  columns: ContactColumn[],
  categoryKey?: string | null
): Promise<{ error?: string }> {
  if (!locationId) return { error: 'Location ID mancante' }
  const supabase = createAdminClient()
  const key = categoryKey ?? '_default'

  // Read existing to merge
  const { data: existing } = await supabase
    .from('location_settings')
    .select('contact_columns')
    .eq('location_id', locationId)
    .single()

  let map: Record<string, ContactColumn[]> = {}
  const raw = (existing as { contact_columns?: unknown } | null)?.contact_columns
  if (Array.isArray(raw)) {
    // Migrate legacy array to new format
    map._default = raw as ContactColumn[]
  } else if (raw && typeof raw === 'object') {
    map = { ...(raw as Record<string, ContactColumn[]>) }
  }
  map[key] = columns

  const { error } = await supabase
    .from('location_settings')
    .upsert(
      { location_id: locationId, contact_columns: map, updated_at: new Date().toISOString() },
      { onConflict: 'location_id' }
    )
  if (error) return { error: error.message }
  return {}
}

// ─── Provvigioni ──────────────────────────────────────────────────────────

export interface ProvvigioneRow {
  id?: string
  nome: string
  tipo: 'fisso' | 'percentuale'
  valore: number
  ordine: number
}

export async function getProvvigioni(locationId: string): Promise<ProvvigioneRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('provvigioni')
    .select('id, nome, tipo, valore, ordine')
    .eq('location_id', locationId)
    .order('ordine')
  return (data ?? []) as ProvvigioneRow[]
}

export async function saveProvvigioni(
  locationId: string,
  rows: ProvvigioneRow[]
): Promise<{ error?: string }> {
  if (!locationId) return { error: 'Location ID mancante' }
  const supabase = createAdminClient()

  // Delete existing then insert fresh
  await supabase.from('provvigioni').delete().eq('location_id', locationId)

  if (rows.length === 0) return {}

  const inserts = rows
    .filter((r) => r.nome.trim())
    .map((r, i) => ({
      location_id: locationId,
      nome: r.nome.trim(),
      tipo: r.tipo,
      valore: r.valore,
      ordine: i,
    }))

  if (inserts.length > 0) {
    const { error } = await supabase.from('provvigioni').insert(inserts)
    if (error) return { error: error.message }
  }
  return {}
}

// ─── User Availability ───────────────────────────────────────────────────────

export interface AvailabilitySlot {
  ghl_user_id: string
  day_of_week: number // 0=Mon, 6=Sun
  start_time: string  // 'HH:MM'
  end_time: string    // 'HH:MM'
  enabled: boolean
}

export async function getUserAvailability(locationId: string): Promise<AvailabilitySlot[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('user_availability')
    .select('ghl_user_id, day_of_week, start_time, end_time, enabled')
    .eq('location_id', locationId)
    .order('ghl_user_id')
    .order('day_of_week')
  return (data ?? []) as AvailabilitySlot[]
}

export async function saveUserAvailability(
  locationId: string,
  slots: AvailabilitySlot[]
): Promise<{ error?: string }> {
  if (!locationId) return { error: 'Location ID mancante' }
  const supabase = createAdminClient()

  // Delete all existing for this location, then insert fresh
  await supabase.from('user_availability').delete().eq('location_id', locationId)

  if (slots.length === 0) return {}

  const inserts = slots.map((s) => ({
    location_id: locationId,
    ghl_user_id: s.ghl_user_id,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    enabled: s.enabled,
  }))

  const { error } = await supabase.from('user_availability').insert(inserts)
  if (error) return { error: error.message }
  return {}
}

// ─── Hidden Tags ────────────────────────────────────────────────────────────

export async function getHiddenTags(locationId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('location_settings')
    .select('hidden_tags')
    .eq('location_id', locationId)
    .single()
  const tags = (data as { hidden_tags?: string[] } | null)?.hidden_tags
  return Array.isArray(tags) ? tags : []
}

export async function saveHiddenTags(
  locationId: string,
  tags: string[]
): Promise<{ error?: string }> {
  if (!locationId) return { error: 'Location ID mancante' }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('location_settings')
    .upsert(
      { location_id: locationId, hidden_tags: tags, updated_at: new Date().toISOString() },
      { onConflict: 'location_id' }
    )
  if (error) return { error: error.message }
  return {}
}

// ─── Category Tags ────────────────────────────────────────────────────────

export async function getCategoryTags(locationId: string): Promise<Record<string, string[]>> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('location_settings')
      .select('category_tags')
      .eq('location_id', locationId)
      .single()
    if (error) return {}
    const tags = (data as { category_tags?: Record<string, string[]> } | null)?.category_tags
    return tags && typeof tags === 'object' ? tags : {}
  } catch {
    return {}
  }
}

export async function saveCategoryTags(
  locationId: string,
  categoryTags: Record<string, string[]>
): Promise<{ error?: string }> {
  if (!locationId) return { error: 'Location ID mancante' }
  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('location_settings')
      .upsert(
        { location_id: locationId, category_tags: categoryTags, updated_at: new Date().toISOString() },
        { onConflict: 'location_id' }
      )
    if (error) return { error: error.message }
    return {}
  } catch {
    return { error: 'Colonna category_tags non disponibile. Eseguire la migrazione 045.' }
  }
}

// ─── Gare Mensili ──────────────────────────────────────────────────────────

export interface GaraRow {
  id?: string
  categoria: string
  obiettivo: number
  tag: string
}

export async function getGareMensili(
  locationId: string,
  month: string // 'YYYY-MM-01'
): Promise<GaraRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('gare_mensili')
    .select('id, categoria, obiettivo, tag')
    .eq('location_id', locationId)
    .eq('month', month)
    .order('categoria')
  return (data ?? []) as GaraRow[]
}

export async function saveGareMensili(
  locationId: string,
  month: string,
  rows: GaraRow[]
): Promise<{ error?: string }> {
  if (!locationId) return { error: 'Location ID mancante' }
  if (!month) return { error: 'Mese mancante' }

  const supabase = createAdminClient()

  // Delete existing rows for this location+month, then insert fresh
  await supabase
    .from('gare_mensili')
    .delete()
    .eq('location_id', locationId)
    .eq('month', month)

  if (rows.length === 0) return {}

  const inserts = rows
    .filter((r) => r.categoria.trim() && r.tag.trim())
    .map((r) => ({
      location_id: locationId,
      month,
      categoria: r.categoria.trim(),
      obiettivo: Math.max(0, r.obiettivo),
      tag: r.tag.trim().toLowerCase(),
    }))

  if (inserts.length > 0) {
    const { error } = await supabase.from('gare_mensili').insert(inserts)
    if (error) return { error: error.message }
  }

  return {}
}

// ─── Closed Days ────────────────────────────────────────────────────────────

export async function getClosedDays(locationId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('location_settings')
    .select('closed_days')
    .eq('location_id', locationId)
    .single()
  const days = (data as { closed_days?: string[] } | null)?.closed_days
  return Array.isArray(days) ? days : []
}

export async function saveClosedDays(
  locationId: string,
  days: string[]
): Promise<{ error?: string }> {
  if (!locationId) return { error: 'Location ID mancante' }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('location_settings')
    .upsert(
      { location_id: locationId, closed_days: days, updated_at: new Date().toISOString() },
      { onConflict: 'location_id' }
    )
  if (error) return { error: error.message }
  return {}
}

// ─── Unique Fields ──────────────────────────────────────────────────────────

export async function getUniqueFields(locationId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('location_settings')
    .select('unique_fields')
    .eq('location_id', locationId)
    .single()
  const fields = (data as { unique_fields?: string[] } | null)?.unique_fields
  return Array.isArray(fields) ? fields : []
}

export async function saveUniqueFields(
  locationId: string,
  fieldIds: string[]
): Promise<{ error?: string }> {
  if (!locationId) return { error: 'Location ID mancante' }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('location_settings')
    .upsert(
      { location_id: locationId, unique_fields: fieldIds, updated_at: new Date().toISOString() },
      { onConflict: 'location_id' }
    )
  if (error) return { error: error.message }
  return {}
}

// ─── Ensure per-category Switch Out fields ─────────────────────────────────

export async function ensureCategorySwitchOutFields(locationId: string): Promise<number | null> {
  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.customFields.list()
    const rawFields = (data?.customFields ?? []) as { id: string; name: string; dataType: string; fieldKey?: string; placeholder?: string; picklistOptions?: string[] }[]
    const fields = rawFields.map((f) => ({ ...f, fieldKey: f.fieldKey ?? f.id }))

    // Discover categories from the Categoria custom field
    const categories = discoverCategories(fields)
    if (categories.length === 0) return 0

    let created = 0
    for (const cat of categories) {
      const fieldName = `[${cat.label}] Switch Out`
      const existing = fields.find((f) => f.name === fieldName)
      if (existing) continue
      // Create as SINGLE_OPTIONS with Si/No — GHL CHECKBOX requires special handling
      await ghl.customFields.create({
        name: fieldName,
        dataType: 'SINGLE_OPTIONS',
        model: 'contact',
        options: ['Si', 'No'],
      })
      created++
    }
    return created
  } catch (err) {
    console.error('[ensureCategorySwitchOutFields]', err)
    return null
  }
}

// ─── GHL Tags Management ───────────────────────────────────────────────────

export interface GhlTag {
  id: string
  name: string
}

export async function getLocationTags(locationId: string): Promise<GhlTag[]> {
  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.tags.list()
    return ((data?.tags ?? []) as GhlTag[]).sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

export async function createLocationTag(
  locationId: string,
  name: string
): Promise<{ error?: string }> {
  if (!locationId) return { error: 'Location ID mancante' }
  if (!name.trim()) return { error: 'Nome tag mancante' }
  try {
    const ghl = await getGhlClient(locationId)
    await ghl.tags.create(name.trim())
    return {}
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Errore creazione tag'
    if (msg.includes('already exist')) return { error: 'Questo tag esiste già' }
    return { error: msg }
  }
}

export async function deleteLocationTag(
  locationId: string,
  tagId: string
): Promise<{ error?: string }> {
  if (!locationId) return { error: 'Location ID mancante' }
  if (!tagId) return { error: 'Tag ID mancante' }
  try {
    const ghl = await getGhlClient(locationId)
    await ghl.tags.delete(tagId)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Errore eliminazione tag' }
  }
}
