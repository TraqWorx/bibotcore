import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
let allOps = []
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('apulia_sync_queue').select('action, status').gte('created_at', '2026-05-06T13:12:00').range(from, from + 999)
  if (!data?.length) break
  allOps = allOps.concat(data)
  if (data.length < 1000) break
}
console.log(`Total ops since 13:12: ${allOps.length}`)
const counts = {}
for (const o of allOps) {
  const k = `${o.action}:${o.status}`
  counts[k] = (counts[k] ?? 0) + 1
}
for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`)
