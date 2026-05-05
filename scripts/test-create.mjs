import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Get a fresh token
const { data: conn } = await sb.from('ghl_connections').select('access_token').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').single()
const token = conn.access_token

// Try a simple create
const body = {
  locationId: 'VtNhBfleEQDg0KX4eZqY',
  firstName: 'TEST CONDOMINIO BIBOT',
  customFields: [
    { id: '3E3OuE0iNMHKe6CWSl3o', value: 'TEST_POD_BIBOT_DELETE_ME' },
    { id: 'kgGrpZOgfUZoeTfhs7Ef', value: 'TEST CLIENT' },
  ],
}
const r = await fetch('https://services.leadconnectorhq.com/contacts/', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
console.log('Status:', r.status)
console.log('Body:', (await r.text()).slice(0, 800))
