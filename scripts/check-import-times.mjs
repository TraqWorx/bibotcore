import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await sb.from('apulia_imports').select('id, kind, status, filename, rows_total, created, updated, skipped, created_at, finished_at').gte('created_at', '2026-05-06T13:00:00').order('created_at', { ascending: false })
for (const r of data ?? []) console.log(`  ${r.kind} ${r.status} created=${r.created} updated=${r.updated} skipped=${r.skipped} started=${r.created_at}`)
console.log(`\nNow: ${new Date().toISOString()}`)
