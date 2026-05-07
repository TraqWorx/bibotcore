import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
// Check the schema
const { data, error } = await sb.from('ghl_webhook_events').select('*').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').limit(1)
console.log('Sample row keys:', data?.[0] ? Object.keys(data[0]) : 'no row')
console.log(JSON.stringify(data?.[0], null, 2).slice(0, 2000))
