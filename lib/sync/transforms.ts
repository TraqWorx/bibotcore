/**
 * GHL API response → Supabase cache row transformers.
 *
 * GHL responses use inconsistent casing (camelCase / snake_case).
 * These transforms normalise to our Supabase schema columns.
 */

// ── Contacts ─────────────────────────────────────────────────

export interface CachedContactRow {
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
  date_added: string | null
  last_activity: string | null
  ghl_updated_at: string | null
  synced_at: string
  raw: Record<string, unknown>
}

export function transformContact(
  locationId: string,
  c: Record<string, unknown>,
): CachedContactRow {
  return {
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
    date_added: (c.dateAdded as string) ?? null,
    last_activity: (c.lastActivity as string) ?? null,
    ghl_updated_at: (c.updatedAt as string) ?? (c.dateUpdated as string) ?? null,
    synced_at: new Date().toISOString(),
    raw: c,
  }
}

// ── Contact Custom Fields ────────────────────────────────────

export interface CachedContactCustomFieldRow {
  location_id: string
  contact_ghl_id: string
  field_id: string
  field_key: string | null
  value: string | null
}

export function transformContactCustomFields(
  locationId: string,
  contactId: string,
  customFields: Array<Record<string, unknown>>,
): CachedContactCustomFieldRow[] {
  if (!Array.isArray(customFields)) return []
  return customFields
    .filter((cf) => cf.id)
    .map((cf) => ({
      location_id: locationId,
      contact_ghl_id: contactId,
      field_id: cf.id as string,
      field_key: (cf.fieldKey as string) ?? (cf.field_key as string) ?? null,
      value: extractFieldValue(cf),
    }))
}

function extractFieldValue(cf: Record<string, unknown>): string | null {
  const v = cf.value ?? cf.field_value ?? cf.fieldValue
  if (v == null) return null
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

// ── Opportunities ────────────────────────────────────────────

export interface CachedOpportunityRow {
  ghl_id: string
  location_id: string
  name: string | null
  pipeline_id: string | null
  pipeline_stage_id: string | null
  contact_ghl_id: string | null
  monetary_value: number | null
  status: string | null
  assigned_to: string | null
  ghl_updated_at: string | null
  synced_at: string
  raw: Record<string, unknown>
}

export function transformOpportunity(
  locationId: string,
  o: Record<string, unknown>,
): CachedOpportunityRow {
  return {
    ghl_id: o.id as string,
    location_id: locationId,
    name: (o.name as string) ?? null,
    pipeline_id: (o.pipelineId as string) ?? null,
    pipeline_stage_id: (o.pipelineStageId as string) ?? null,
    contact_ghl_id: (o.contactId as string) ?? (o.contact_id as string) ?? null,
    monetary_value: typeof o.monetaryValue === 'number' ? o.monetaryValue : null,
    status: (o.status as string) ?? null,
    assigned_to: (o.assignedTo as string) ?? null,
    ghl_updated_at: (o.updatedAt as string) ?? (o.dateUpdated as string) ?? null,
    synced_at: new Date().toISOString(),
    raw: o,
  }
}

// ── Pipelines ────────────────────────────────────────────────

export interface CachedPipelineRow {
  ghl_id: string
  location_id: string
  name: string | null
  stages: unknown
  synced_at: string
}

export function transformPipeline(
  locationId: string,
  p: Record<string, unknown>,
): CachedPipelineRow {
  return {
    ghl_id: p.id as string,
    location_id: locationId,
    name: (p.name as string) ?? null,
    stages: Array.isArray(p.stages) ? p.stages : [],
    synced_at: new Date().toISOString(),
  }
}

// ── Conversations ────────────────────────────────────────────

export interface CachedConversationRow {
  ghl_id: string
  location_id: string
  contact_ghl_id: string | null
  contact_name: string | null
  type: string | null
  last_message_body: string | null
  last_message_date: string | null
  last_message_direction: string | null
  unread_count: number
  assigned_to: string | null
  synced_at: string
  raw: Record<string, unknown>
}

/** Normalise a date value that may be ISO string, epoch ms, or epoch seconds */
function normalizeDate(val: unknown): string | null {
  if (val == null) return null
  if (typeof val === 'string') {
    // Already ISO or date string
    if (val.includes('T') || val.includes('-')) return val
    // Numeric string (epoch)
    const n = Number(val)
    if (!isNaN(n)) return new Date(n > 1e12 ? n : n * 1000).toISOString()
    return val
  }
  if (typeof val === 'number') {
    return new Date(val > 1e12 ? val : val * 1000).toISOString()
  }
  return null
}

export function transformConversation(
  locationId: string,
  c: Record<string, unknown>,
): CachedConversationRow {
  return {
    ghl_id: c.id as string,
    location_id: locationId,
    contact_ghl_id: (c.contactId as string) ?? (c.contact_id as string) ?? null,
    contact_name: (c.fullName as string) ?? (c.contactName as string) ?? null,
    type: (c.type as string) ?? null,
    last_message_body: (c.lastMessageBody as string) ?? null,
    last_message_date: normalizeDate(c.lastMessageDate),
    last_message_direction: (c.lastMessageDirection as string) ?? null,
    unread_count: typeof c.unreadCount === 'number' ? c.unreadCount : 0,
    assigned_to: (c.assignedTo as string) ?? null,
    synced_at: new Date().toISOString(),
    raw: c,
  }
}

// ── Tasks ────────────────────────────────────────────────────

export interface CachedTaskRow {
  ghl_id: string
  location_id: string
  contact_ghl_id: string
  title: string | null
  due_date: string | null
  completed: boolean
  synced_at: string
}

export function transformTask(
  locationId: string,
  contactId: string,
  t: Record<string, unknown>,
): CachedTaskRow {
  return {
    ghl_id: t.id as string,
    location_id: locationId,
    contact_ghl_id: contactId,
    title: (t.title as string) ?? null,
    due_date: (t.dueDate as string) ?? null,
    completed: t.completed === true,
    synced_at: new Date().toISOString(),
  }
}

// ── Notes ────────────────────────────────────────────────────

export interface CachedNoteRow {
  ghl_id: string
  location_id: string
  contact_ghl_id: string
  body: string | null
  date_added: string | null
  created_by: string | null
  synced_at: string
}

export function transformNote(
  locationId: string,
  contactId: string,
  n: Record<string, unknown>,
): CachedNoteRow {
  return {
    ghl_id: n.id as string,
    location_id: locationId,
    contact_ghl_id: contactId,
    body: (n.body as string) ?? null,
    date_added: (n.dateAdded as string) ?? null,
    created_by: (n.userId as string) ?? null,
    synced_at: new Date().toISOString(),
  }
}

// ── Custom Field Definitions ─────────────────────────────────

export interface CachedCustomFieldRow {
  field_id: string
  location_id: string
  name: string | null
  field_key: string | null
  data_type: string | null
  placeholder: string | null
  picklist_options: string[]
  synced_at: string
}

export function transformCustomFieldDef(
  locationId: string,
  f: Record<string, unknown>,
): CachedCustomFieldRow {
  return {
    field_id: f.id as string,
    location_id: locationId,
    name: (f.name as string) ?? null,
    field_key: (f.fieldKey as string) ?? null,
    data_type: (f.dataType as string) ?? null,
    placeholder: (f.placeholder as string) ?? null,
    picklist_options: Array.isArray(f.picklistOptions) ? f.picklistOptions : [],
    synced_at: new Date().toISOString(),
  }
}
