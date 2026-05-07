import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { parseSpreadsheet } from '@/lib/apulia/spreadsheet'
import { ghlFetch } from '@/lib/apulia/ghl'
import { APULIA_LOCATION_ID } from '@/lib/apulia/fields'
import { initPdp, processPdpChunk, finalizePdp } from '@/lib/apulia/pdp-chunked'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const CHUNK_SIZE = 500

/**
 * DB-first PDP import. Parses the file, writes all rows to apulia_contacts
 * in chunks (each ~500 rows), and enqueues outbound sync ops onto
 * apulia_sync_queue. Recompute runs at the end. The sync worker drains
 * the queue asynchronously to push everything into GHL.
 *
 * No GHL writes happen here, so there's no rate-limit risk and a 4000-row
 * file completes in ~5–10s.
 */
export async function POST(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) {
    if (profile?.role !== 'super_admin') return new Response('Forbidden', { status: 403 })
  }
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    return new Response('Forbidden', { status: 403 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return new Response('Missing file', { status: 400 })

  const { headers, rows } = await parseSpreadsheet(file)
  if (rows.length === 0) return new Response('Empty file', { status: 400 })

  const fieldsRes = await ghlFetch(`/locations/${APULIA_LOCATION_ID}/customFields`)
  const allFields = (await fieldsRes.json()).customFields as { id: string; name: string }[]

  const init = await initPdp(rows, headers, allFields)

  const { data: imp } = await sb.from('apulia_imports').insert({
    kind: 'pdp',
    filename: file.name,
    rows_total: rows.length,
    progress_done: 0,
    progress_total: rows.length,
    last_progress_at: new Date().toISOString(),
    status: 'running',
    triggered_by: user.email ?? null,
  }).select('id').single()
  const importId = imp?.id as string | undefined

  let counters = { created: 0, updated: 0, untagged: 0, unmatched: 0, skipped: 0 }
  let totalCollapsedDuplicates = 0
  const allDuplicatePodSamples: Array<{ pod: string; rows: number }> = []
  const createdInRun: Record<string, { id: string; firstName?: string; tags?: string[] }> = {}

  try {
    for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
      const slice = rows.slice(offset, offset + CHUNK_SIZE)
      const view = { ...init.byPodInit, ...createdInRun }
      const out = await processPdpChunk(slice, init.colFieldMap, view, counters, importId)
      counters = out.counters
      totalCollapsedDuplicates += out.collapsedDuplicates ?? 0
      if (out.duplicatePodSamples) allDuplicatePodSamples.push(...out.duplicatePodSamples)
      Object.assign(createdInRun, out.newCreated)
      if (importId) {
        await sb.from('apulia_imports').update({
          progress_done: Math.min(offset + slice.length, rows.length),
          created: counters.created,
          updated: counters.updated,
          untagged: counters.untagged,
          unmatched: counters.unmatched,
          skipped: counters.skipped,
          last_progress_at: new Date().toISOString(),
        }).eq('id', importId)
      }
    }

    const { adminCreates, recomputed } = await finalizePdp(rows, init.colFieldMap, importId)

    if (importId) {
      await sb.from('apulia_imports').update({
        status: 'completed',
        progress_done: rows.length,
        finished_at: new Date().toISOString(),
        last_progress_at: new Date().toISOString(),
        summary: {
          skippedReasons: { no_pod: counters.skipped },
          rowsWithPod: rows.length - counters.skipped,
          newCondominiCreated: counters.created,
          existingCondominiUpdated: counters.updated,
          switchOutCleared: counters.untagged,
          newAdminsAutoCreated: adminCreates,
          collapsedDuplicatePods: totalCollapsedDuplicates,
          duplicatePodSamples: allDuplicatePodSamples.slice(0, 10),
          recompute: recomputed,
        },
      }).eq('id', importId)
    }

    return NextResponse.json({
      importId,
      total: rows.length,
      ...counters,
      adminCreates,
      recomputed,
    })
  } catch (err) {
    if (importId) {
      await sb.from('apulia_imports').update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_msg: err instanceof Error ? err.message : 'pdp import failed',
      }).eq('id', importId)
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : 'pdp import failed' }, { status: 500 })
  }
}
