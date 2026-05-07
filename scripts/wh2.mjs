import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { count: total } = await sb.from('ghl_webhook_events').select('id', { count: 'exact', head: true })
console.log(`Total webhook events: ${total}`)
const { count: apulia } = await sb.from('ghl_webhook_events').select('id', { count: 'exact', head: true }).eq('location_id', 'VtNhBfleEQDg0KX4eZqY')
console.log(`Apulia events: ${apulia}`)
const { data: latest } = await sb.from('ghl_webhook_events').select('id, location_id, event_type, created_at').order('created_at', { ascending: false }).limit(5)
console.log('Latest 5 (any location):')
for (const e of latest ?? []) console.log(`  ${e.event_type} ${e.location_id?.slice(0,8)} at ${e.created_at}`)
