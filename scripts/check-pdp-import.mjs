import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: imports } = await sb.from('apulia_imports').select('id, kind, status, filename, rows_total, progress_done, created, updated, untagged, unmatched, skipped, created_at').eq('kind', 'pdp').order('created_at', { ascending: false }).limit(2)
for (const r of imports ?? []) console.log(r)
console.log('\n--- Ops grouped by latest PDP import ---')
const latest = imports?.[0]
if (latest) {
  const { count: total } = await sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('import_id', latest.id)
  const { count: created } = await sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('import_id', latest.id).eq('action', 'create')
  const { count: setField } = await sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('import_id', latest.id).eq('action', 'set_field')
  const { count: removeTag } = await sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('import_id', latest.id).eq('action', 'remove_tag')
  console.log({ total, created, setField, removeTag })
}
