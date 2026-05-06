import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const [{ data: jobs }, { data: secret }, { data: runs }, { data: net }] = await Promise.all([
  sb.rpc('apulia_debug_cron'),
  sb.rpc('apulia_debug_cron_secret'),
  sb.rpc('apulia_debug_cron_runs', { n: 10 }),
  sb.rpc('apulia_debug_pg_net', { n: 10 }),
])

console.log('Cron jobs:'); console.table(jobs)
console.log('\nVault cron_secret:'); console.table(secret)
console.log('\nLast 10 sync-dispatch runs:'); console.table(runs)
console.log('\nLast 10 pg_net HTTP responses (any endpoint):'); console.table(net)
