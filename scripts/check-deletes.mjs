import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Look at recent completed delete ops (which would have hard-deleted rows)
const { data } = await sb.from('apulia_sync_queue').select('id, contact_id, ghl_id, action, created_at, completed_at, last_error').eq('action', 'delete').eq('status', 'completed').gte('completed_at', '2026-05-06T13:00:00').order('completed_at', { ascending: false }).limit(10)
console.log(`Recent completed delete ops in last hour: ${data?.length}`)
for (const r of data ?? []) console.log(`  op ${r.id.slice(0,8)} contact ${r.contact_id?.slice(0,8)} ghl=${r.ghl_id} completed=${r.completed_at}`)

// Also: check failed ops with case-A or case-B detail
const { data: completed } = await sb.from('apulia_sync_queue').select('action, status').gte('created_at', '2026-05-06T13:00:00').limit(5000)
const counts = {}
for (const o of completed ?? []) {
  const k = `${o.action}:${o.status}`
  counts[k] = (counts[k] ?? 0) + 1
}
console.log(`\nRecent ops by action:status:`)
for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`)
