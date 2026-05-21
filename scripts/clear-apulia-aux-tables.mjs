import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

for (const t of ['apulia_payments', 'apulia_imports', 'apulia_opportunities', 'apulia_sync_queue']) {
  const { count: before } = await sb.from(t).select('*', { count: 'exact', head: true })
  await sb.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  const { count: after } = await sb.from(t).select('*', { count: 'exact', head: true })
  console.log(`${t.padEnd(28)} ${before} → ${after}`)
}
