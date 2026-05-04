import { NextRequest } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { parseCsv } from '@/lib/apulia/csv'
import { importAdmins } from '@/lib/apulia/import-admins'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') {
    if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) return new Response('Forbidden', { status: 403 })
    if (profile.role !== 'admin') return new Response('Forbidden', { status: 403 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return new Response('Missing file', { status: 400 })

  const text = await file.text()
  const { rows } = parseCsv(text)
  if (rows.length === 0) return new Response('Empty CSV', { status: 400 })

  const filename = file.name
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'))
      let summary: Record<string, unknown> = { kind: 'admins' }
      try {
        for await (const evt of importAdmins(rows)) {
          send(evt)
          if (evt.type === 'done') summary = { ...evt }
        }
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'failed' })
      } finally {
        try {
          const sb2 = createAdminClient()
          await sb2.from('apulia_imports').insert({
            kind: 'pdp', // legacy column constraint allows pdp/switch_out only; reuse pdp for admins as a soft category
            filename: filename ? `[ADMINS] ${filename}` : 'admins',
            rows_total: rows.length,
            created: (summary.created as number) ?? 0,
            updated: (summary.updated as number) ?? 0,
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
