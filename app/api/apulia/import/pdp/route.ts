import { NextRequest } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { parseSpreadsheet } from '@/lib/apulia/spreadsheet'
import { importPdp } from '@/lib/apulia/import-pdp'
import { ghlFetch } from '@/lib/apulia/ghl'
import { APULIA_LOCATION_ID } from '@/lib/apulia/fields'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // Hobby plan ceiling

export async function POST(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) {
    return new Response('Forbidden', { status: 403 })
  }
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    return new Response('Forbidden', { status: 403 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return new Response('Missing file', { status: 400 })

  const { headers, rows } = await parseSpreadsheet(file)
  if (rows.length === 0) return new Response('Empty file', { status: 400 })

  // Pre-fetch field-name → id map so importPdp can match columns to fields.
  const fieldsRes = await ghlFetch(`/locations/${APULIA_LOCATION_ID}/customFields`)
  const allFields = (await fieldsRes.json()).customFields as { id: string; name: string }[]

  const filename = file.name

  // Insert a 'running' row so the Imports page can show progress even
  // if the operator refreshes mid-import.
  const sbInit = createAdminClient()
  const { data: imp } = await sbInit.from('apulia_imports').insert({
    kind: 'pdp',
    filename,
    rows_total: rows.length,
    progress_done: 0,
    progress_total: rows.length,
    last_progress_at: new Date().toISOString(),
    status: 'running',
    triggered_by: user.email ?? null,
  }).select('id').single()
  const importId = imp?.id as string | undefined

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (obj: unknown) => {
        try { controller.enqueue(enc.encode(JSON.stringify(obj) + '\n')) } catch { /* client gone */ }
      }
      const sb2 = createAdminClient()

      let summary: Record<string, unknown> = { kind: 'pdp' }
      let failed = false
      try {
        for await (const evt of importPdp(rows, headers, allFields)) {
          send(evt)
          if (evt.type === 'progress' && importId) {
            await sb2.from('apulia_imports').update({
              progress_done: evt.done,
              created: evt.created,
              updated: evt.updated,
              untagged: evt.untagged,
              unmatched: evt.unmatched,
              skipped: evt.skipped,
              last_progress_at: new Date().toISOString(),
            }).eq('id', importId)
          }
          if (evt.type === 'done') summary = { ...evt }
        }
      } catch (err) {
        failed = true
        send({ type: 'error', message: err instanceof Error ? err.message : 'failed' })
      } finally {
        if (importId) {
          await sb2.from('apulia_imports').update({
            status: failed ? 'failed' : 'completed',
            progress_done: (summary.created as number ?? 0) + (summary.updated as number ?? 0) + (summary.skipped as number ?? 0) + (summary.unmatched as number ?? 0),
            created: (summary.created as number) ?? 0,
            updated: (summary.updated as number) ?? 0,
            untagged: (summary.untagged as number) ?? 0,
            unmatched: (summary.unmatched as number) ?? 0,
            skipped: (summary.skipped as number) ?? 0,
            duration_ms: (summary.durationMs as number) ?? null,
            finished_at: new Date().toISOString(),
            last_progress_at: new Date().toISOString(),
          }).eq('id', importId).then(() => undefined, () => undefined)
        }
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
