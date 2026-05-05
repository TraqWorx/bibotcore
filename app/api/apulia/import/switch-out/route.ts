import { NextRequest } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { parseSpreadsheet } from '@/lib/apulia/spreadsheet'
import { importSwitchOut } from '@/lib/apulia/import-switchout'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) return new Response('Forbidden', { status: 403 })
  if (profile.role !== 'admin' && profile.role !== 'super_admin') return new Response('Forbidden', { status: 403 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return new Response('Missing file', { status: 400 })

  const { rows } = await parseSpreadsheet(file)
  if (rows.length === 0) return new Response('Empty file', { status: 400 })

  const filename = file.name
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'))
      let summary: Record<string, unknown> = { kind: 'switch_out' }
      try {
        for await (const evt of importSwitchOut(rows)) {
          send(evt)
          if (evt.type === 'done') summary = { ...evt }
        }
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'failed' })
      } finally {
        try {
          const sb2 = createAdminClient()
          await sb2.from('apulia_imports').insert({
            kind: 'switch_out',
            filename,
            rows_total: rows.length,
            tagged: (summary.tagged as number) ?? 0,
            unmatched: (summary.unmatched as number) ?? 0,
            duration_ms: (summary.durationMs as number) ?? null,
            status: 'completed',
            triggered_by: user.email ?? null,
            finished_at: new Date().toISOString(),
          })
        } catch { /* swallow */ }
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
