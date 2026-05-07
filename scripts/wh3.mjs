import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data, error } = await sb.from('ghl_webhook_events').select('event_type, created_at, payload').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').order('created_at', { ascending: false }).limit(5)
console.log('error:', error)
console.log('count:', data?.length)
for (const e of data ?? []) {
  const p = e.payload ?? {}
  console.log(`  ${e.event_type} at ${e.created_at}`)
  console.log(`    tags: ${JSON.stringify(p.tags ?? p?.contact?.tags ?? p?.data?.tags ?? null)}`)
}
