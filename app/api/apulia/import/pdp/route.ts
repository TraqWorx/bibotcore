import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { parseSpreadsheet } from '@/lib/apulia/spreadsheet'
import { ghlFetch } from '@/lib/apulia/ghl'
import { APULIA_LOCATION_ID } from '@/lib/apulia/fields'
import { initPdp } from '@/lib/apulia/pdp-chunked'
import { triggerPdpContinue } from './_continue-trigger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Resumable PDP import. The initial POST parses the file, fetches the
 * GHL field map and the byPod snapshot, persists everything to
 * apulia_imports, then fires off a /continue invocation to start
 * processing. Returns the import id immediately so the client can
 * watch progress in the Storico (no streaming response).
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

  const { data: imp, error: insertErr } = await sb.from('apulia_imports').insert({
    kind: 'pdp',
    filename: file.name,
    rows_total: rows.length,
    progress_done: 0,
    progress_total: rows.length,
    last_progress_at: new Date().toISOString(),
    status: 'running',
    triggered_by: user.email ?? null,
    payload: { rows },
    payload_meta: {
      colFieldMap: init.colFieldMap,
      byPodInit: init.byPodInit,
      createdInRun: {},
    },
  }).select('id').single()
  if (insertErr || !imp) {
    return NextResponse.json({ error: insertErr?.message ?? 'failed to enqueue import' }, { status: 500 })
  }

  // Fire-and-forget continuation. The trigger helper retries briefly so
  // the request actually leaves before this function returns.
  await triggerPdpContinue(imp.id)

  return NextResponse.json({ importId: imp.id, total: rows.length })
}
