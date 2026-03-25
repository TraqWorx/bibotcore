'use server'

import { createAdminClient, createAuthClient } from '@/lib/supabase-server'
import { getGhlClient } from '@/lib/ghl/ghlClient'

async function assertSuperAdmin() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') throw new Error('Not authorized')
}

// ─── CUSTOM FIELDS ORGANIZED BY CATEGORY (prefixed) ──────────────────────
// GHL folders API doesn't support Contact fields — only Custom Objects & Company.
// So we prefix field names with [Category] to keep them visually organized.
interface CFDef {
  name: string
  dataType: string
  placeholder?: string
  options?: string[]
}

interface FieldGroup {
  category: string
  fields: CFDef[]
}

const FIELD_GROUPS: FieldGroup[] = [
  {
    category: 'Anagrafica',
    fields: [
      { name: 'Codice Fiscale', dataType: 'TEXT', placeholder: 'RSSMRA85M01H501Z' },
      { name: 'Partita IVA', dataType: 'TEXT', placeholder: '12345678901' },
      { name: 'Numero Master', dataType: 'PHONE', placeholder: '+39 333 1234567' },
      { name: 'Classificazione Cliente', dataType: 'SINGLE_OPTIONS', options: ['Bronzo', 'Argento', 'Oro'] },
      { name: 'Tipo Cliente', dataType: 'SINGLE_OPTIONS', options: ['Privato', 'Business'] },
    ],
  },
  {
    category: 'Telefonia',
    fields: [
      { name: 'Gestore', dataType: 'SINGLE_OPTIONS', options: ['WindTre', 'Fastweb', 'Kena', 'Very', 'Iliad', 'PosteMobile', 'ho.'] },
      { name: 'Offerta Attivata', dataType: 'TEXT', placeholder: 'Nome offerta' },
      { name: 'Costo Offerta', dataType: 'MONETORY', placeholder: '€' },
      { name: 'Smartphone Rateizzato', dataType: 'TEXT', placeholder: 'Modello + rata mensile' },
      { name: 'Vincolo Contrattuale', dataType: 'SINGLE_OPTIONS', options: ['24 mesi', '30 mesi', 'Nessuno'] },
      { name: 'Scadenza Offerta', dataType: 'DATE' },
      { name: 'Data Attivazione Telefonia', dataType: 'DATE' },
      { name: 'MNP', dataType: 'SINGLE_OPTIONS', options: ['Sì', 'No'] },
      { name: 'Gestore Provenienza', dataType: 'SINGLE_OPTIONS', options: ['WindTre', 'Fastweb', 'Kena', 'Very', 'Iliad', 'TIM', 'Vodafone', 'PosteMobile', 'ho.', 'Altro'] },
      { name: 'Intestatario SIM', dataType: 'TEXT', placeholder: 'Se diverso dal contatto' },
      { name: 'Parentela Intestatario', dataType: 'SINGLE_OPTIONS', options: ['Coniuge', 'Figlio', 'Genitore', 'Altro'] },
    ],
  },
  {
    category: 'Energia',
    fields: [
      { name: 'Fornitore Energia', dataType: 'SINGLE_OPTIONS', options: ['Dolomiti', 'Enel', 'Eni', 'A2A', 'Altro'] },
      { name: 'Luce/Gas', dataType: 'SINGLE_OPTIONS', options: ['Luce', 'Gas', 'Luce+Gas'] },
      { name: 'POD/PDR', dataType: 'TEXT', placeholder: 'Codice POD o PDR' },
      { name: 'Tipologia Utenza', dataType: 'SINGLE_OPTIONS', options: ['Residente', 'Non Residente', 'Business'] },
      { name: 'Tariffa Energia', dataType: 'TEXT', placeholder: 'Nome tariffa' },
      { name: 'Costo Energia', dataType: 'MONETORY', placeholder: '€' },
      { name: 'Scadenza Contratto Energia', dataType: 'DATE' },
      { name: 'Data Attivazione Energia', dataType: 'DATE' },
      { name: 'Metodo Pagamento', dataType: 'SINGLE_OPTIONS', options: ['Bollettino', 'RID', 'Carta di Credito', 'Altro'] },
      { name: 'Tipo Attività', dataType: 'TEXT' },
      { name: 'Referente Contratto', dataType: 'TEXT', placeholder: 'Numero master o nome contatto' },
    ],
  },
  {
    category: 'Connettività',
    fields: [
      { name: 'Gestore Fibra/ADSL', dataType: 'SINGLE_OPTIONS', options: ['WindTre', 'Fastweb', 'TIM', 'Vodafone', 'Altro'] },
      { name: 'Numero Fisso', dataType: 'PHONE' },
      { name: 'Tecnologia', dataType: 'SINGLE_OPTIONS', options: ['FTTH', 'FTTC', 'ADSL', 'FWA'] },
      { name: 'Offerta Connettività', dataType: 'TEXT' },
      { name: 'Costo Mensile Connettività', dataType: 'MONETORY', placeholder: '€' },
      { name: 'Data Attivazione Connettività', dataType: 'DATE' },
      { name: 'Scadenza Contratto Connettività', dataType: 'DATE' },
    ],
  },
  {
    category: 'Intrattenimento',
    fields: [
      { name: 'Piattaforma', dataType: 'SINGLE_OPTIONS', options: ['SKY', 'DAZN', 'Netflix', 'Disney+', 'Amazon Prime', 'Altro'] },
      { name: 'Offerta Intrattenimento', dataType: 'TEXT' },
      { name: 'Costo Mensile Intrattenimento', dataType: 'MONETORY', placeholder: '€' },
      { name: 'Scadenza Contratto Intrattenimento', dataType: 'DATE' },
    ],
  },
  {
    category: 'Provv. Energia',
    fields: [
      { name: 'Tipo Contratto Energia', dataType: 'SINGLE_OPTIONS', options: ['Standard', 'Minus', 'Micro', 'Plus', 'Business'] },
      { name: 'SEPA Attivo', dataType: 'SINGLE_OPTIONS', options: ['Sì', 'No'] },
      { name: 'Gettone Attivo', dataType: 'SINGLE_OPTIONS', options: ['Sì', 'No'] },
      { name: 'Standard/Minus/Micro', dataType: 'TEXT' },
      { name: 'Plus/Extra Attivo', dataType: 'SINGLE_OPTIONS', options: ['Sì', 'No'] },
      { name: 'Web Attivo', dataType: 'SINGLE_OPTIONS', options: ['Sì', 'No'] },
      { name: 'Compenso Totale Energia', dataType: 'MONETORY', placeholder: '€ calcolato' },
    ],
  },
  {
    category: 'Provv. Telefonia',
    fields: [
      { name: 'Tipo Offerta Venduta', dataType: 'TEXT' },
      { name: 'Punteggio Wind', dataType: 'NUMERICAL' },
      { name: 'Moltiplicatore', dataType: 'FLOAT' },
      { name: 'Compenso Telecom Calcolato', dataType: 'MONETORY', placeholder: '€ calcolato' },
    ],
  },
  {
    category: 'Staff',
    fields: [
      { name: 'Collaboratore', dataType: 'TEXT', placeholder: 'Nome collaboratore' },
    ],
  },
]

// ─── TAGS DEFINITION ────────────────────────────────────────────────────
const TAGS: string[] = [
  // Operatori
  'WindTre', 'Fastweb', 'Kena', 'Very', 'Iliad',
  // Tipo Servizio
  'Telefonia', 'Luce', 'Gas', 'Fibra', 'Intrattenimento',
  // Fornitore Energia
  'Dolomiti', 'Enel', 'Eni',
  // Tipo Cliente
  'Privato', 'Business',
  // Stato Lead
  'Lead', 'Contattato', 'Appuntamento', 'Attivato', 'Perso',
  // Stato Contratto
  'Attivo', 'In Scadenza', 'Scaduto', 'Cessato',
  // Fonte Gara
  'Gara-WindTre', 'Gara-Fastweb', 'Gara-Kena', 'Gara-Fibra', 'Gara-Energia',
]

// ─── PIPELINES DEFINITION ───────────────────────────────────────────────
const PIPELINES = [
  {
    name: 'Lead Telefonia',
    stages: [
      { name: 'Nuovo Lead' },
      { name: 'Contattato' },
      { name: 'Appuntamento Fissato' },
      { name: 'No Show' },
      { name: 'Proposta Inviata' },
      { name: 'Attivato' },
      { name: 'Perso' },
    ],
  },
  {
    name: 'Lead Energia',
    stages: [
      { name: 'Nuovo Lead' },
      { name: 'Contattato' },
      { name: 'Appuntamento Fissato' },
      { name: 'No Show' },
      { name: 'Proposta Inviata' },
      { name: 'Attivato' },
      { name: 'Perso' },
    ],
  },
  {
    name: 'Rinnovi / Scadenze',
    stages: [
      { name: 'In Scadenza (60gg)' },
      { name: 'Contattato per Rinnovo' },
      { name: 'Appuntamento Rinnovo' },
      { name: 'Rinnovato' },
      { name: 'Perso / Migrato' },
    ],
  },
]

// ─── PROVISION ACTION ───────────────────────────────────────────────────
export async function provisionLocation(
  locationId: string
): Promise<{ log: string[]; error?: string }> {
  const log: string[] = []
  try {
    await assertSuperAdmin()
    const ghl = await getGhlClient(locationId)

    // 1. Delete ALL existing custom fields
    log.push('Fetching existing custom fields...')
    const existingFields = await ghl.customFields.list()
    const allFields: { id: string; name: string }[] = existingFields?.customFields ?? []
    log.push(`Found ${allFields.length} existing custom fields`)

    for (const field of allFields) {
      try {
        await ghl.customFields.delete(field.id)
        log.push(`Deleted: ${field.name}`)
      } catch (err) {
        log.push(`Failed to delete ${field.name}: ${err instanceof Error ? err.message : err}`)
      }
    }

    // 2. Create custom fields with [Category] prefix for organization
    // GHL folders API only supports Custom Objects & Company, not Contacts.
    // Prefix names so they sort together in GHL's "Additional Info" section.
    log.push('')
    log.push('Creating custom fields...')
    let totalCreated = 0
    const totalFields = FIELD_GROUPS.reduce((sum, g) => sum + g.fields.length, 0)

    for (const group of FIELD_GROUPS) {
      for (const cf of group.fields) {
        const prefixedName = `[${group.category}] ${cf.name}`
        try {
          const body: Record<string, unknown> = {
            name: prefixedName,
            dataType: cf.dataType,
          }
          if (cf.options) body.options = cf.options
          if (cf.placeholder) body.placeholder = cf.placeholder
          await ghl.customFields.create(body as { name: string; dataType: string; options?: string[]; placeholder?: string })
          totalCreated++
          log.push(`${prefixedName} (${cf.dataType})`)
        } catch (err) {
          log.push(`FAILED ${prefixedName}: ${err instanceof Error ? err.message : err}`)
        }
      }
    }
    log.push(`Fields: ${totalCreated}/${totalFields} created`)

    // 3. Create tags
    log.push('')
    log.push('Creating tags...')
    let tagsCreated = 0
    for (const tag of TAGS) {
      try {
        await ghl.tags.create(tag)
        tagsCreated++
        log.push(`Tag: ${tag}`)
      } catch (err) {
        log.push(`Tag ${tag}: ${err instanceof Error ? err.message : err}`)
      }
    }
    log.push(`Created ${tagsCreated}/${TAGS.length} tags`)

    // 4. Create pipelines
    log.push('')
    log.push('Creating pipelines...')
    for (const pipeline of PIPELINES) {
      try {
        await ghl.pipelines.create(pipeline)
        log.push(`Pipeline: ${pipeline.name} (${pipeline.stages.length} stages)`)
      } catch (err) {
        log.push(`Pipeline ${pipeline.name}: ${err instanceof Error ? err.message : err}`)
      }
    }

    // Mark install as configured
    const supabase = createAdminClient()
    await supabase
      .from('installs')
      .update({ configured: true })
      .eq('location_id', locationId)

    log.push('')
    log.push('Provisioning complete!')
    return { log }
  } catch (err) {
    return { log, error: err instanceof Error ? err.message : 'Provisioning failed' }
  }
}

