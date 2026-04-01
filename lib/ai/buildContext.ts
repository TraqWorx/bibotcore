/**
 * Build a rich data context from ALL cached Supabase tables for a location.
 * This is sent to Claude so it can answer any question about the CRM data.
 */

import { createAdminClient } from '@/lib/supabase-server'

export async function buildLocationContext(locationId: string): Promise<string> {
  const sb = createAdminClient()

  const [
    { count: totalContacts },
    { data: contacts },
    { data: cfValues },
    { data: fieldDefs },
    { data: opportunities },
    { data: pipelines },
    { data: conversations },
    { data: tags },
    { data: users },
    { data: calendarEvents },
    { data: notes },
    { data: tasks },
    { data: invoices },
  ] = await Promise.all([
    sb.from('cached_contacts').select('*', { count: 'exact', head: true }).eq('location_id', locationId),
    sb.from('cached_contacts').select('ghl_id, first_name, last_name, email, phone, company_name, tags, assigned_to, date_added').eq('location_id', locationId).order('date_added', { ascending: false }).limit(500),
    sb.from('cached_contact_custom_fields').select('contact_ghl_id, field_id, value').eq('location_id', locationId),
    sb.from('cached_custom_fields').select('field_id, name, data_type').eq('location_id', locationId),
    sb.from('cached_opportunities').select('ghl_id, name, pipeline_id, pipeline_stage_id, contact_ghl_id, monetary_value, status').eq('location_id', locationId),
    sb.from('cached_pipelines').select('ghl_id, name, stages').eq('location_id', locationId),
    sb.from('cached_conversations').select('ghl_id, contact_ghl_id, contact_name, type, last_message_date, unread_count').eq('location_id', locationId),
    sb.from('cached_tags').select('name').eq('location_id', locationId),
    sb.from('cached_ghl_users').select('ghl_id, name, email, role').eq('location_id', locationId),
    sb.from('cached_calendar_events').select('ghl_id, contact_ghl_id, title, start_time, appointment_status').eq('location_id', locationId).order('start_time', { ascending: false }).limit(100),
    sb.from('cached_notes').select('ghl_id, contact_ghl_id, body, date_added').eq('location_id', locationId).order('date_added', { ascending: false }).limit(100),
    sb.from('cached_tasks').select('ghl_id, contact_ghl_id, title, due_date, completed').eq('location_id', locationId),
    sb.from('cached_invoices').select('ghl_id, contact_ghl_id, name, status, amount_due, amount_paid, currency').eq('location_id', locationId),
  ])

  // Build field name map
  const fieldNameMap = new Map((fieldDefs ?? []).map((f) => [f.field_id, f.name ?? '']))

  // Build stage name map
  const stageMap = new Map<string, string>()
  for (const p of pipelines ?? []) {
    const stages = Array.isArray(p.stages) ? p.stages as { id: string; name: string }[] : []
    for (const s of stages) stageMap.set(s.id, s.name)
  }

  // Build per-contact custom field summary
  const cfByContact = new Map<string, string[]>()
  for (const cf of cfValues ?? []) {
    if (!cf.value) continue
    const fieldName = fieldNameMap.get(cf.field_id) ?? cf.field_id
    if (!cfByContact.has(cf.contact_ghl_id)) cfByContact.set(cf.contact_ghl_id, [])
    cfByContact.get(cf.contact_ghl_id)!.push(`${fieldName}: ${cf.value}`)
  }

  // Category counts
  const categoryCounts = new Map<string, number>()
  const categoriaFieldId = (fieldDefs ?? []).find((f) => f.name === 'Categoria')?.field_id
  if (categoriaFieldId) {
    for (const cf of cfValues ?? []) {
      if (cf.field_id !== categoriaFieldId || !cf.value) continue
      for (const cat of cf.value.split(',').map((s: string) => s.trim()).filter(Boolean)) {
        categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1)
      }
    }
  }

  // Provider counts per category
  const providerCounts = new Map<string, Map<string, number>>()
  for (const cf of cfValues ?? []) {
    if (!cf.value) continue
    const fieldName = fieldNameMap.get(cf.field_id) ?? ''
    const match = fieldName.match(/^\[([^\]]+)\]\s*(.+)$/)
    if (match) {
      const category = match[1]
      const displayName = match[2].toLowerCase()
      if (displayName.includes('gestore') || displayName.includes('fornitore') || displayName.includes('operatore')) {
        if (!providerCounts.has(category)) providerCounts.set(category, new Map())
        const map = providerCounts.get(category)!
        map.set(cf.value, (map.get(cf.value) ?? 0) + 1)
      }
    }
  }

  // Per-user contact counts
  const userContactCounts = new Map<string, number>()
  for (const c of contacts ?? []) {
    if (c.assigned_to) userContactCounts.set(c.assigned_to, (userContactCounts.get(c.assigned_to) ?? 0) + 1)
  }

  // Build context string
  const parts: string[] = []

  parts.push(`=== PANORAMICA ===`)
  parts.push(`Contatti totali: ${totalContacts ?? 0}`)
  parts.push(`Opportunità: ${(opportunities ?? []).length} (aperte: ${(opportunities ?? []).filter(o => o.status === 'open').length}, vinte: ${(opportunities ?? []).filter(o => o.status === 'won').length}, perse: ${(opportunities ?? []).filter(o => o.status === 'lost').length})`)
  parts.push(`Valore totale pipeline: €${(opportunities ?? []).filter(o => o.status === 'open').reduce((s, o) => s + (Number(o.monetary_value) || 0), 0).toFixed(2)}`)
  parts.push(`Conversazioni: ${(conversations ?? []).length} (non lette: ${(conversations ?? []).filter(c => c.unread_count > 0).length})`)
  parts.push(`Appuntamenti (ultimi 100): ${(calendarEvents ?? []).length}`)
  parts.push(`Note: ${(notes ?? []).length}`)
  parts.push(`Task: ${(tasks ?? []).length} (completati: ${(tasks ?? []).filter(t => t.completed).length})`)
  parts.push(`Fatture: ${(invoices ?? []).length}`)
  parts.push(`Tag disponibili: ${(tags ?? []).map(t => t.name).join(', ')}`)

  // Categories
  if (categoryCounts.size > 0) {
    parts.push(`\n=== CATEGORIE ===`)
    for (const [cat, count] of categoryCounts) {
      const providers = providerCounts.get(cat)
      let providerStr = ''
      if (providers && providers.size > 0) {
        providerStr = ' — ' + Array.from(providers.entries()).map(([p, c]) => `${p}: ${c}`).join(', ')
      }
      parts.push(`${cat}: ${count} contatti${providerStr}`)
    }
  }

  // Operators
  if ((users ?? []).length > 0) {
    parts.push(`\n=== OPERATORI ===`)
    for (const u of users ?? []) {
      const count = userContactCounts.get(u.ghl_id) ?? 0
      parts.push(`${u.name ?? u.email} (${u.role ?? 'team'}): ${count} contatti assegnati`)
    }
  }

  // Pipelines
  if ((pipelines ?? []).length > 0) {
    parts.push(`\n=== PIPELINE ===`)
    for (const p of pipelines ?? []) {
      const stages = Array.isArray(p.stages) ? p.stages as { id: string; name: string }[] : []
      const pipeOpps = (opportunities ?? []).filter(o => o.pipeline_id === p.ghl_id)
      parts.push(`${p.name}:`)
      for (const stage of stages) {
        const stageOpps = pipeOpps.filter(o => o.pipeline_stage_id === stage.id)
        if (stageOpps.length > 0) {
          const value = stageOpps.reduce((s, o) => s + (Number(o.monetary_value) || 0), 0)
          parts.push(`  ${stage.name}: ${stageOpps.length} deal (€${value.toFixed(0)})`)
        }
      }
    }
  }

  // Recent contacts (first 50 with custom fields)
  parts.push(`\n=== CONTATTI RECENTI (primi 50) ===`)
  for (const c of (contacts ?? []).slice(0, 50)) {
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Sconosciuto'
    const cfs = cfByContact.get(c.ghl_id)?.join('; ') ?? ''
    const tagStr = (c.tags ?? []).length > 0 ? ` [${(c.tags as string[]).join(', ')}]` : ''
    parts.push(`${name} (${c.email ?? 'no email'})${tagStr}${cfs ? ' — ' + cfs : ''}`)
  }

  return parts.join('\n')
}
