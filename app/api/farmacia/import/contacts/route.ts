import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { parseSpreadsheet } from '@/lib/apulia/spreadsheet'
import { SHIPPYPRO_MAP } from '@/lib/farmacia/import-config'
import { validateContactRows, IMPORT_BOXES, type ImportBox } from '@/lib/farmacia/import-contacts'
import { persistContactImport } from '@/lib/farmacia/import-contacts-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const BUCKET = 'farmacia-imports'

/**
 * Channel-box contact import (Modulo 3). ?box=amazon|ebay|store. Validates min
 * columns + phone, dedups by phone (adding the box tag to existing contacts),
 * and enqueues the tag to GHL so the nurturing automation fires. Stores the
 * original file for download and records a rich import-history row.
 */
export async function POST(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  const isOwner = profile?.role === 'super_admin' || profile?.role === 'admin' || (!!profile?.agency_id && isBibotAgency(profile.agency_id))
  if (!isOwner) return new Response('Forbidden', { status: 403 })

  const box = req.nextUrl.searchParams.get('box') as ImportBox | null
  if (!box || !IMPORT_BOXES.some((b) => b.key === box)) return new Response('Invalid box', { status: 400 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return new Response('Missing file', { status: 400 })

  const { rows } = await parseSpreadsheet(file)
  if (rows.length === 0) return new Response('Empty file', { status: 400 })

  const { valid, discarded, reasons } = validateContactRows(rows, SHIPPYPRO_MAP)

  const { data: imp } = await sb.from('farmacia_imports').insert({
    kind: 'contacts', origin: box, filename: file.name, rows_total: rows.length,
    progress_total: rows.length, status: 'running', triggered_by: user.email ?? null,
  }).select('id').single()
  const importId = imp?.id as string | undefined

  // Store the original file for download (best-effort).
  let fileUrl: string | null = null
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const path = `${importId}/${file.name}`
    const up = await sb.storage.from(BUCKET).upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: true })
    if (!up.error) fileUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  } catch { /* non-fatal */ }

  const started = Date.now()
  try {
    const result = await persistContactImport(valid, box, importId ?? null)
    await sb.from('farmacia_imports').update({
      status: 'completed', file_url: fileUrl,
      created: result.created, updated: result.updated, discarded,
      duration_ms: Date.now() - started, progress_done: rows.length,
      finished_at: new Date().toISOString(),
      summary: { reasons, ...result },
    }).eq('id', importId!)
    return NextResponse.json({ importId, box, records: rows.length, ...result, discarded, reasons, fileUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed'
    if (importId) await sb.from('farmacia_imports').update({ status: 'failed', error_msg: message, file_url: fileUrl, finished_at: new Date().toISOString() }).eq('id', importId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
