import { NextResponse } from 'next/server'
import { getGhlClient } from '@/lib/ghl/ghlClient'

// This API route is deprecated — use the server action in app/admin/provision/_actions.ts instead.
// Kept for backward compatibility.

const TAGS = [
  'WindTre', 'Fastweb', 'Kena', 'Very', 'Iliad',
  'Telefonia', 'Luce', 'Gas', 'Fibra', 'Intrattenimento',
  'Dolomiti', 'Enel', 'Eni',
  'Privato', 'Business',
  'Lead', 'Contattato', 'Appuntamento', 'Attivato', 'Perso',
  'Attivo', 'In Scadenza', 'Scaduto', 'Cessato',
  'Gara-WindTre', 'Gara-Fastweb', 'Gara-Kena', 'Gara-Fibra', 'Gara-Energia',
]

const PIPELINES = [
  {
    name: 'Lead Telefonia',
    stages: [
      { name: 'Nuovo Lead' }, { name: 'Contattato' }, { name: 'Appuntamento Fissato' },
      { name: 'No Show' }, { name: 'Proposta Inviata' }, { name: 'Attivato' }, { name: 'Perso' },
    ],
  },
  {
    name: 'Lead Energia',
    stages: [
      { name: 'Nuovo Lead' }, { name: 'Contattato' }, { name: 'Appuntamento Fissato' },
      { name: 'No Show' }, { name: 'Proposta Inviata' }, { name: 'Attivato' }, { name: 'Perso' },
    ],
  },
  {
    name: 'Rinnovi / Scadenze',
    stages: [
      { name: 'In Scadenza (60gg)' }, { name: 'Contattato per Rinnovo' },
      { name: 'Appuntamento Rinnovo' }, { name: 'Rinnovato' }, { name: 'Perso / Migrato' },
    ],
  },
]

export async function POST(request: Request) {
  const { locationId, action } = await request.json()
  if (!locationId) return NextResponse.json({ error: 'Missing locationId' }, { status: 400 })

  const log: string[] = []
  try {
    const ghl = await getGhlClient(locationId)

    if (!action || action === 'tags') {
      log.push('Creating tags...')
      for (const tag of TAGS) {
        try {
          await ghl.tags.create(tag)
          log.push(`Tag OK: ${tag}`)
        } catch {
          log.push(`Tag skip: ${tag}`)
        }
      }
    }

    if (!action || action === 'pipelines') {
      log.push('Creating pipelines...')
      for (const pipeline of PIPELINES) {
        try {
          await ghl.pipelines.create(pipeline)
          log.push(`Pipeline OK: ${pipeline.name}`)
        } catch (err) {
          log.push(`Pipeline FAILED: ${pipeline.name}: ${err instanceof Error ? err.message : err}`)
        }
      }
    }

    log.push('DONE!')
    return NextResponse.json({ log })
  } catch (err) {
    return NextResponse.json({ log, error: err instanceof Error ? err.message : 'Failed' })
  }
}
