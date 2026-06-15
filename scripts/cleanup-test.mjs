import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: conn } = await sb.from('ghl_connections').select('access_token').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').single()
const r = await fetch('https://services.leadconnectorhq.com/contacts/ioRACAQYJmd2Jq4FeA8G', {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${conn.access_token}`, Version: '2021-07-28' },
})
console.log('DELETE test contact:', r.status)
