import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const probe = await sb.from('apulia_contacts').select('id, ghl_id, sync_status').limit(1)
console.log('apulia_contacts ghl_id/sync_status columns:', probe.error ? `MISSING (${probe.error.message})` : 'PRESENT')

const q = await sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true })
console.log('apulia_sync_queue table:', q.error ? `MISSING (${q.error.message})` : `PRESENT (rows=${q.count})`)

const backfill = await sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).is('ghl_id', null)
console.log('apulia_contacts WHERE ghl_id IS NULL:', backfill.error ? `ERROR (${backfill.error.message})` : `count=${backfill.count}`)

const total = await sb.from('apulia_contacts').select('id', { count: 'exact', head: true })
console.log('apulia_contacts total rows:', total.error ? `ERROR (${total.error.message})` : `count=${total.count}`)
