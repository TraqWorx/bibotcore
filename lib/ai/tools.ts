/**
 * AI Tool definitions + executors for Claude tool_use.
 * Each tool maps to an existing server action or Supabase operation.
 */

import { createAdminClient } from '@/lib/supabase-server'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import { writeThroughContact, writeThroughOpportunity, writeThroughNote } from '@/lib/sync/writeThrough'
import { createBulkJob } from '@/lib/sync/bulkActions'

// ── Tool definitions (sent to Claude) ────────────────────────

export const AI_TOOLS = [
  {
    name: 'search_contacts',
    description: 'Search contacts by name, email, phone, or tag. Returns matching contacts with their details.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term (name, email, phone)' },
        tag: { type: 'string', description: 'Filter by tag name' },
      },
      required: ['query'],
    },
  },
  {
    name: 'add_tag_to_contact',
    description: 'Add a tag to a contact. Requires contact email or name to find them, and the tag to add.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contactEmail: { type: 'string', description: 'Contact email to find' },
        contactName: { type: 'string', description: 'Contact name to find (if no email)' },
        tag: { type: 'string', description: 'Tag to add' },
      },
      required: ['tag'],
    },
  },
  {
    name: 'remove_tag_from_contact',
    description: 'Remove a tag from a contact.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contactEmail: { type: 'string', description: 'Contact email' },
        contactName: { type: 'string', description: 'Contact name (if no email)' },
        tag: { type: 'string', description: 'Tag to remove' },
      },
      required: ['tag'],
    },
  },
  {
    name: 'update_contact_field',
    description: 'Update a custom field value for a contact. Use the field name (not ID).',
    input_schema: {
      type: 'object' as const,
      properties: {
        contactEmail: { type: 'string', description: 'Contact email' },
        contactName: { type: 'string', description: 'Contact name (if no email)' },
        fieldName: { type: 'string', description: 'Custom field name (e.g. "Gestore", "Scadenza")' },
        value: { type: 'string', description: 'New value' },
      },
      required: ['fieldName', 'value'],
    },
  },
  {
    name: 'create_note',
    description: 'Create a note on a contact.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contactEmail: { type: 'string', description: 'Contact email' },
        contactName: { type: 'string', description: 'Contact name (if no email)' },
        body: { type: 'string', description: 'Note text' },
      },
      required: ['body'],
    },
  },
  {
    name: 'move_deal',
    description: 'Move a deal/opportunity to a different pipeline stage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dealName: { type: 'string', description: 'Deal name to find' },
        stageName: { type: 'string', description: 'Target stage name' },
      },
      required: ['dealName', 'stageName'],
    },
  },
  {
    name: 'update_deal_status',
    description: 'Change a deal status to open, won, or lost.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dealName: { type: 'string', description: 'Deal name' },
        status: { type: 'string', enum: ['open', 'won', 'lost'], description: 'New status' },
      },
      required: ['dealName', 'status'],
    },
  },
  {
    name: 'bulk_add_tag',
    description: 'Add a tag to multiple contacts matching a filter. Can filter by: tag, custom field value, deal monetary value (min/max), category. Returns how many contacts were updated.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tag: { type: 'string', description: 'Tag to add to matching contacts' },
        filterTag: { type: 'string', description: 'Only contacts that have this existing tag' },
        filterCategory: { type: 'string', description: 'Only contacts in this Categoria value' },
        filterFieldName: { type: 'string', description: 'Filter by custom field name' },
        filterFieldValue: { type: 'string', description: 'Filter by custom field value' },
        filterMinDealValue: { type: 'number', description: 'Only contacts with deals worth at least this amount' },
        filterMaxDealValue: { type: 'number', description: 'Only contacts with deals worth at most this amount' },
      },
      required: ['tag'],
    },
  },
  {
    name: 'bulk_remove_tag',
    description: 'Remove a tag from multiple contacts matching a filter. Same filters as bulk_add_tag.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tag: { type: 'string', description: 'Tag to remove from matching contacts' },
        filterTag: { type: 'string', description: 'Only contacts that have this existing tag' },
        filterCategory: { type: 'string', description: 'Only contacts in this Categoria value' },
        filterFieldName: { type: 'string', description: 'Filter by custom field name' },
        filterFieldValue: { type: 'string', description: 'Filter by custom field value' },
        filterMinDealValue: { type: 'number', description: 'Minimum deal value' },
        filterMaxDealValue: { type: 'number', description: 'Maximum deal value' },
      },
      required: ['tag'],
    },
  },
  {
    name: 'bulk_update_field',
    description: 'Update a custom field for multiple contacts matching a filter.',
    input_schema: {
      type: 'object' as const,
      properties: {
        fieldName: { type: 'string', description: 'Custom field name to update' },
        value: { type: 'string', description: 'New value' },
        filterTag: { type: 'string', description: 'Only contacts with this tag' },
        filterCategory: { type: 'string', description: 'Only contacts in this Categoria' },
        filterMinDealValue: { type: 'number', description: 'Minimum deal value' },
      },
      required: ['fieldName', 'value'],
    },
  },
]

// ── Tool executor ────────────────────────────────────────────

export async function executeTool(
  locationId: string,
  toolName: string,
  input: Record<string, string>,
): Promise<string> {
  const sb = createAdminClient()

  switch (toolName) {
    case 'search_contacts': {
      const q = `%${input.query}%`
      let query = sb.from('cached_contacts')
        .select('ghl_id, first_name, last_name, email, phone, tags')
        .eq('location_id', locationId)
        .or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},phone.ilike.${q}`)
        .limit(10)
      if (input.tag) query = query.contains('tags', [input.tag])
      const { data } = await query
      if (!data || data.length === 0) return 'Nessun contatto trovato.'
      return data.map((c) => `${c.first_name ?? ''} ${c.last_name ?? ''} (${c.email ?? 'no email'}) - Tags: ${(c.tags ?? []).join(', ') || 'nessuno'}`).join('\n')
    }

    case 'add_tag_to_contact':
    case 'remove_tag_from_contact': {
      const contact = await findContact(sb, locationId, input.contactEmail, input.contactName)
      if (!contact) return 'Contatto non trovato.'
      const ghl = await getGhlClient(locationId)
      const currentTags: string[] = contact.tags ?? []
      const newTags = toolName === 'add_tag_to_contact'
        ? [...new Set([...currentTags, input.tag])]
        : currentTags.filter((t) => t.toLowerCase() !== input.tag.toLowerCase())
      await ghl.contacts.update(contact.ghl_id, { tags: newTags })
      await writeThroughContact(locationId, { id: contact.ghl_id, tags: newTags })
      // Ensure tag exists in GHL + cached_tags
      if (toolName === 'add_tag_to_contact') {
        try {
          const tagResult = await ghl.tags.create(input.tag)
          const tagId = tagResult?.tag?.id ?? tagResult?.id ?? `ai-${Date.now()}`
          await sb.from('cached_tags').upsert({
            ghl_id: tagId, location_id: locationId, name: input.tag, synced_at: new Date().toISOString(),
          } as never, { onConflict: 'location_id,ghl_id' })
        } catch {
          // Tag may already exist — add to cache anyway
          await sb.from('cached_tags').upsert({
            ghl_id: `ai-${Date.now()}`, location_id: locationId, name: input.tag, synced_at: new Date().toISOString(),
          } as never, { onConflict: 'location_id,ghl_id' })
        }
      }
      return toolName === 'add_tag_to_contact'
        ? `Tag "${input.tag}" aggiunto a ${contact.first_name} ${contact.last_name}.`
        : `Tag "${input.tag}" rimosso da ${contact.first_name} ${contact.last_name}.`
    }

    case 'update_contact_field': {
      const contact = await findContact(sb, locationId, input.contactEmail, input.contactName)
      if (!contact) return 'Contatto non trovato.'
      const { data: fieldDef } = await sb.from('cached_custom_fields')
        .select('field_id').eq('location_id', locationId).ilike('name', `%${input.fieldName}%`).limit(1).single()
      if (!fieldDef) return `Campo "${input.fieldName}" non trovato.`
      const ghl = await getGhlClient(locationId)
      await ghl.contacts.update(contact.ghl_id, {
        customFields: [{ id: fieldDef.field_id, field_value: input.value }],
      })
      await sb.from('cached_contact_custom_fields').upsert({
        location_id: locationId, contact_ghl_id: contact.ghl_id,
        field_id: fieldDef.field_id, value: input.value,
      } as never, { onConflict: 'location_id,contact_ghl_id,field_id' })
      return `Campo "${input.fieldName}" aggiornato a "${input.value}" per ${contact.first_name} ${contact.last_name}.`
    }

    case 'create_note': {
      const contact = await findContact(sb, locationId, input.contactEmail, input.contactName)
      if (!contact) return 'Contatto non trovato.'
      const ghl = await getGhlClient(locationId)
      const result = await ghl.notes.create(contact.ghl_id, input.body)
      const note = result?.note ?? result
      if (note?.id) await writeThroughNote(locationId, contact.ghl_id, note)
      return `Nota creata per ${contact.first_name} ${contact.last_name}.`
    }

    case 'move_deal': {
      const { data: deal } = await sb.from('cached_opportunities')
        .select('ghl_id, pipeline_id').eq('location_id', locationId).ilike('name', `%${input.dealName}%`).limit(1).single()
      if (!deal) return `Deal "${input.dealName}" non trovato.`
      const { data: pipeline } = await sb.from('cached_pipelines')
        .select('stages').eq('location_id', locationId).eq('ghl_id', deal.pipeline_id!).single()
      const stages = (Array.isArray(pipeline?.stages) ? pipeline.stages : []) as { id: string; name: string }[]
      const stage = stages.find((s) => s.name.toLowerCase().includes(input.stageName.toLowerCase()))
      if (!stage) return `Stadio "${input.stageName}" non trovato. Stadi disponibili: ${stages.map(s => s.name).join(', ')}`
      const ghl = await getGhlClient(locationId)
      await ghl.opportunities.updateStage(deal.ghl_id, stage.id)
      await writeThroughOpportunity(locationId, { id: deal.ghl_id, pipelineStageId: stage.id })
      return `Deal "${input.dealName}" spostato a "${stage.name}".`
    }

    case 'update_deal_status': {
      const { data: deal } = await sb.from('cached_opportunities')
        .select('ghl_id').eq('location_id', locationId).ilike('name', `%${input.dealName}%`).limit(1).single()
      if (!deal) return `Deal "${input.dealName}" non trovato.`
      const ghl = await getGhlClient(locationId)
      await ghl.opportunities.update(deal.ghl_id, { status: input.status })
      await writeThroughOpportunity(locationId, { id: deal.ghl_id, status: input.status })
      return `Deal "${input.dealName}" aggiornato a "${input.status}".`
    }

    case 'bulk_add_tag':
    case 'bulk_remove_tag': {
      const contacts = await findBulkContacts(sb, locationId, input)
      if (contacts.length === 0) return 'Nessun contatto corrisponde ai filtri.'
      const action = toolName === 'bulk_add_tag' ? 'add_tag' : 'remove_tag'
      const { jobId, total } = await createBulkJob({
        locationId,
        action: action as 'add_tag' | 'remove_tag',
        description: `${action === 'add_tag' ? 'Aggiungi' : 'Rimuovi'} tag "${input.tag}" a ${contacts.length} contatti`,
        contactGhlIds: contacts.map((c) => c.ghl_id),
        params: { tag: input.tag },
      })
      const verb = action === 'add_tag' ? 'aggiunto' : 'rimosso'
      return `Job creato: tag "${input.tag}" ${verb} a ${total} contatti nel nostro database. Sincronizzazione con GHL in corso in background. ID job: ${jobId}`
    }

    case 'bulk_update_field': {
      const contacts = await findBulkContacts(sb, locationId, input)
      if (contacts.length === 0) return 'Nessun contatto corrisponde ai filtri.'
      const { data: fieldDef } = await sb.from('cached_custom_fields')
        .select('field_id').eq('location_id', locationId).ilike('name', `%${input.fieldName}%`).limit(1).single()
      if (!fieldDef) return `Campo "${input.fieldName}" non trovato.`
      const { jobId, total } = await createBulkJob({
        locationId,
        action: 'update_field',
        description: `Aggiorna "${input.fieldName}" a "${input.value}" per ${contacts.length} contatti`,
        contactGhlIds: contacts.map((c) => c.ghl_id),
        params: { fieldId: fieldDef.field_id, fieldName: input.fieldName, value: input.value },
      })
      return `Job creato: campo "${input.fieldName}" aggiornato a "${input.value}" per ${total} contatti nel nostro database. Sincronizzazione con GHL in background. ID job: ${jobId}`
    }

    default:
      return `Tool "${toolName}" non riconosciuto.`
  }
}

// ── Helpers ──────────────────────────────────────────────────

async function findContact(
  sb: ReturnType<typeof createAdminClient>,
  locationId: string,
  email?: string,
  name?: string,
) {
  if (email) {
    const { data } = await sb.from('cached_contacts')
      .select('ghl_id, first_name, last_name, email, tags')
      .eq('location_id', locationId).ilike('email', email).limit(1).single()
    if (data) return data
  }
  if (name) {
    const q = `%${name}%`
    const { data } = await sb.from('cached_contacts')
      .select('ghl_id, first_name, last_name, email, tags')
      .eq('location_id', locationId)
      .or(`first_name.ilike.${q},last_name.ilike.${q}`)
      .limit(1).single()
    if (data) return data
  }
  return null
}

/**
 * Find contacts matching bulk filters.
 * Supports: tag, category, custom field, deal monetary value.
 */
async function findBulkContacts(
  sb: ReturnType<typeof createAdminClient>,
  locationId: string,
  filters: Record<string, string | number | undefined>,
): Promise<{ ghl_id: string; tags: string[] }[]> {
  // Start with all contacts
  let query = sb.from('cached_contacts')
    .select('ghl_id, tags')
    .eq('location_id', locationId)

  // Filter by existing tag
  if (filters.filterTag) {
    query = query.contains('tags', [filters.filterTag as string])
  }

  const { data: allContacts } = await query
  let contacts = allContacts ?? []

  // Filter by category (custom field)
  if (filters.filterCategory) {
    const { data: fieldDef } = await sb.from('cached_custom_fields')
      .select('field_id').eq('location_id', locationId).eq('name', 'Categoria').limit(1).single()
    if (fieldDef) {
      const { data: cfRows } = await sb.from('cached_contact_custom_fields')
        .select('contact_ghl_id, value')
        .eq('location_id', locationId).eq('field_id', fieldDef.field_id)
      const matchIds = new Set(
        (cfRows ?? [])
          .filter((r) => r.value?.toLowerCase().includes((filters.filterCategory as string).toLowerCase()))
          .map((r) => r.contact_ghl_id)
      )
      contacts = contacts.filter((c) => matchIds.has(c.ghl_id))
    }
  }

  // Filter by custom field value
  if (filters.filterFieldName && filters.filterFieldValue) {
    const { data: fieldDef } = await sb.from('cached_custom_fields')
      .select('field_id').eq('location_id', locationId).ilike('name', `%${filters.filterFieldName}%`).limit(1).single()
    if (fieldDef) {
      const { data: cfRows } = await sb.from('cached_contact_custom_fields')
        .select('contact_ghl_id')
        .eq('location_id', locationId).eq('field_id', fieldDef.field_id)
        .ilike('value', `%${filters.filterFieldValue}%`)
      const matchIds = new Set((cfRows ?? []).map((r) => r.contact_ghl_id))
      contacts = contacts.filter((c) => matchIds.has(c.ghl_id))
    }
  }

  // Filter by deal monetary value
  if (filters.filterMinDealValue || filters.filterMaxDealValue) {
    const { data: opps } = await sb.from('cached_opportunities')
      .select('contact_ghl_id, monetary_value')
      .eq('location_id', locationId)

    // Sum deal values per contact
    const contactTotals = new Map<string, number>()
    for (const o of opps ?? []) {
      if (!o.contact_ghl_id) continue
      contactTotals.set(o.contact_ghl_id, (contactTotals.get(o.contact_ghl_id) ?? 0) + (Number(o.monetary_value) || 0))
    }

    contacts = contacts.filter((c) => {
      const total = contactTotals.get(c.ghl_id) ?? 0
      if (filters.filterMinDealValue && total < Number(filters.filterMinDealValue)) return false
      if (filters.filterMaxDealValue && total > Number(filters.filterMaxDealValue)) return false
      return true
    })
  }

  return contacts
}
