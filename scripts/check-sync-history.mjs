import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

console.log('=== apulia_imports (latest 5) ===')
const { data: imports } = await sb.from('apulia_imports').select('id, kind, filename, status, created_at').order('created_at', { ascending: false }).limit(5)
for (const r of imports ?? []) console.log(`  ${r.id.slice(0,8)} ${r.kind} ${r.status} ${r.filename} ${r.created_at}`)

console.log('\n=== apulia_sync_queue total + by status ===')
const [{ count: total }, { count: pending }, { count: completed }, { count: failed }, { count: withImportId }] = await Promise.all([
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }),
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).not('import_id', 'is', null),
])
console.log({ total, pending, completed, failed, withImportId })

if (imports?.length) {
  const latest = imports[0]
  console.log(`\n=== ops for latest import ${latest.id.slice(0,8)} ===`)
  const [{ count: pen }, { count: ip }, { count: comp }, { count: fail }] = await Promise.all([
    sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('import_id', latest.id).eq('status', 'pending'),
    sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('import_id', latest.id).eq('status', 'in_progress'),
    sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('import_id', latest.id).eq('status', 'completed'),
    sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('import_id', latest.id).eq('status', 'failed'),
  ])
  console.log({ pending: pen, inProgress: ip, completed: comp, failed: fail })
}
