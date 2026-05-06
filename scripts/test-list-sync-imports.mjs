import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Re-implement listSyncImports server-side logic for inspection
const { data: imports } = await sb.from('apulia_imports').select('id, kind, filename, created_at').order('created_at', { ascending: false }).limit(50)
const { data: opRows } = await sb.from('apulia_sync_queue').select('import_id, status').limit(100_000)
console.log(`Imports rows: ${imports?.length}, ops rows: ${opRows?.length}`)

const counts = new Map()
for (const r of opRows ?? []) {
  const key = r.import_id ?? '__manual__'
  let c = counts.get(key)
  if (!c) { c = { pending: 0, in_progress: 0, completed: 0, failed: 0, total: 0 }; counts.set(key, c) }
  c.total++
  if (r.status === 'pending') c.pending++
  else if (r.status === 'in_progress') c.in_progress++
  else if (r.status === 'completed') c.completed++
  else if (r.status === 'failed') c.failed++
}

console.log('\n=== Summaries that would render ===')
const manual = counts.get('__manual__')
if (manual?.total > 0) console.log(`  Manual: ${JSON.stringify(manual)}`)
for (const imp of imports ?? []) {
  const c = counts.get(imp.id) ?? { total: 0 }
  if (c.total === 0) { console.log(`  SKIPPED (total=0): ${imp.id.slice(0,8)} ${imp.kind} ${imp.filename}`); continue }
  console.log(`  ${imp.id.slice(0,8)} ${imp.kind} ${imp.filename} ${imp.created_at} → ${JSON.stringify(c)}`)
}
