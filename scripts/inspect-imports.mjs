import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await sb.from('apulia_imports').select('*').order('created_at', { ascending: false }).limit(5)
for (const r of data ?? []) {
  console.log({
    id: r.id, kind: r.kind, status: r.status, filename: r.filename,
    rows_total: r.rows_total, progress_done: r.progress_done,
    created: r.created, updated: r.updated, skipped: r.skipped, untagged: r.untagged, unmatched: r.unmatched,
    error_msg: r.error_msg, finished_at: r.finished_at,
  })
}
