/**
 * Category-aware custom field utilities for the Simfonia design.
 *
 * GHL custom fields are prefixed with `[Category] FieldName`.
 * The available categories are driven by the "Categoria" dropdown custom field.
 * Adding/removing options in that field dynamically changes dashboard sections,
 * contact creation dropdown, and contact list filters.
 */

export interface CategoryDef {
  slug: string
  label: string
}

/** Category prefixes that are shared (always shown) — not standalone categories */
export const SHARED_CATEGORIES = ['Anagrafica']

/** Category prefixes hidden from non-admin users */
const HIDDEN_PREFIXES = ['Provv.', 'Staff']

export function isHiddenCategory(category: string): boolean {
  return HIDDEN_PREFIXES.some((p) => category.startsWith(p))
}

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const BRACKET_RE = /^\[([^\]]+)\]\s*(.+)$/

export interface ParsedField {
  category: string | null // null = no bracket prefix
  displayName: string     // field name with prefix stripped
}

export function parseFieldCategory(name: string): ParsedField {
  const m = name.match(BRACKET_RE)
  if (!m) return { category: null, displayName: name }
  return { category: m[1], displayName: m[2] }
}

export interface CustomFieldDef {
  id: string
  name: string
  fieldKey: string
  dataType: string
  placeholder?: string
  picklistOptions?: string[]
}

/** Name of the master "Categoria" dropdown field */
export const CATEGORIA_FIELD_NAME = 'Categoria'

/**
 * Find the "Categoria" dropdown field and return its options as CategoryDef[].
 * This is the single source of truth for available categories.
 */
export function discoverCategories(fields: CustomFieldDef[]): CategoryDef[] {
  const catField = fields.find((f) => f.name === CATEGORIA_FIELD_NAME && f.dataType === 'SINGLE_OPTIONS')
  if (!catField?.picklistOptions) return []
  return catField.picklistOptions.map((label) => ({
    slug: slugify(label),
    label,
  }))
}

/** Get the "Categoria" field itself */
export function getCategoriaField(fields: CustomFieldDef[]): CustomFieldDef | undefined {
  return fields.find((f) => f.name === CATEGORIA_FIELD_NAME && f.dataType === 'SINGLE_OPTIONS')
}

/**
 * Match a category label to its bracket prefix in field names.
 * E.g. "Connettività Casa" matches "[Connettività]" prefix.
 * Uses startsWith to handle partial matches (e.g. "Connettività Casa" → "[Connettività]").
 */
function labelMatchesPrefix(prefix: string, categoryLabel: string): boolean {
  return (
    prefix === categoryLabel ||
    categoryLabel.startsWith(prefix) ||
    prefix.startsWith(categoryLabel)
  )
}

/** Get fields for a specific category label + Anagrafica shared fields */
export function getFieldsForCategory(
  fields: CustomFieldDef[],
  categoryLabel: string,
): CustomFieldDef[] {
  return fields.filter((f) => {
    // Skip the Categoria dropdown itself
    if (f.name === CATEGORIA_FIELD_NAME) return false
    const { category } = parseFieldCategory(f.name)
    if (!category) return false
    return (
      labelMatchesPrefix(category, categoryLabel) ||
      SHARED_CATEGORIES.includes(category)
    )
  })
}

/** Keywords that identify the "provider/gestore" field within a category */
const PROVIDER_KEYWORDS = ['gestore', 'fornitore', 'piattaforma', 'provider', 'operatore']

/**
 * Get ALL SINGLE_OPTIONS fields for a category — used to render dropdowns
 * at the top of contact forms (e.g. Gestore, Gestore di provenienza, etc.).
 * Sorted so provider-keyword fields (Gestore, Fornitore) come first (shortest name first).
 */
export function getDropdownFields(
  fields: CustomFieldDef[],
  categoryLabel: string,
): CustomFieldDef[] {
  const result = fields.filter((f) => {
    if (f.name === CATEGORIA_FIELD_NAME) return false
    const { category } = parseFieldCategory(f.name)
    if (!category) return false
    return labelMatchesPrefix(category, categoryLabel) && f.dataType === 'SINGLE_OPTIONS'
  })
  // Sort: provider-keyword matches first (shortest name = most exact), then the rest
  return result.sort((a, b) => {
    const aName = parseFieldCategory(a.name).displayName.toLowerCase()
    const bName = parseFieldCategory(b.name).displayName.toLowerCase()
    const aIsProvider = PROVIDER_KEYWORDS.some((kw) => aName.includes(kw))
    const bIsProvider = PROVIDER_KEYWORDS.some((kw) => bName.includes(kw))
    if (aIsProvider && !bIsProvider) return -1
    if (!aIsProvider && bIsProvider) return 1
    if (aIsProvider && bIsProvider) return aName.length - bName.length
    return 0
  })
}

/**
 * Get the main "provider" field for a category — the SINGLE_OPTIONS field whose
 * display name best matches a provider keyword (shortest match wins, so "Gestore"
 * is preferred over "Gestore di provenienza").
 * Falls back to the first SINGLE_OPTIONS field if no keyword match is found.
 */
export function getProviderField(
  fields: CustomFieldDef[],
  categoryLabel: string,
): CustomFieldDef | undefined {
  const categoryFields = getDropdownFields(fields, categoryLabel)

  // Find all fields matching a provider keyword, prefer the shortest display name
  const matches = categoryFields
    .filter((f) => {
      const { displayName } = parseFieldCategory(f.name)
      const lower = displayName.toLowerCase()
      return PROVIDER_KEYWORDS.some((kw) => lower.includes(kw))
    })
    .sort((a, b) => {
      const aName = parseFieldCategory(a.name).displayName
      const bName = parseFieldCategory(b.name).displayName
      return aName.length - bName.length // shorter = more exact match
    })

  return matches[0] ?? categoryFields[0]
}

/** Group fields by their parsed category */
export function groupFieldsByCategory(
  fields: CustomFieldDef[],
): Map<string, CustomFieldDef[]> {
  const map = new Map<string, CustomFieldDef[]>()
  for (const f of fields) {
    if (f.name === CATEGORIA_FIELD_NAME) continue
    const { category } = parseFieldCategory(f.name)
    const key = category ?? 'Altro'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(f)
  }
  return map
}

/**
 * Get the "Scadenza" date field for a category — a DATE field
 * whose display name contains "Scadenza".
 */
export function getScadenzaField(
  fields: CustomFieldDef[],
  categoryLabel: string,
): CustomFieldDef | undefined {
  return fields.find((f) => {
    if (f.name === CATEGORIA_FIELD_NAME) return false
    const { category, displayName } = parseFieldCategory(f.name)
    if (!category) return false
    return (
      labelMatchesPrefix(category, categoryLabel) &&
      f.dataType === 'DATE' &&
      displayName.toLowerCase().includes('scadenza')
    )
  })
}

/** Parse a potentially comma-separated Categoria value into an array of labels */
export function parseCategoriaValue(raw: string): string[] {
  if (!raw) return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

/** Filter out hidden-category fields for non-admin users */
export function filterVisibleFields(
  fields: CustomFieldDef[],
  isAdmin: boolean,
): CustomFieldDef[] {
  if (isAdmin) return fields
  return fields.filter((f) => {
    const { category } = parseFieldCategory(f.name)
    if (!category) return true
    return !isHiddenCategory(category)
  })
}
