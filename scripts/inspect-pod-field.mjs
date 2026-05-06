import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: tok } = await sb.from('ghl_connections').select('access_token').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').maybeSingle()
const r = await fetch('https://services.leadconnectorhq.com/locations/VtNhBfleEQDg0KX4eZqY/customFields', {
  headers: { Authorization: `Bearer ${tok.access_token}`, Version: '2021-07-28' },
})
const j = await r.json()
const POD_ID = '3E3OuE0iNMHKe6CWSl3o'
const podField = (j.customFields ?? []).find(f => f.id === POD_ID)
console.log('POD/PDR field meta:', podField)
const CLIENTE_ID = 'kgGrpZOgfUZoeTfhs7Ef'
const clienteField = (j.customFields ?? []).find(f => f.id === CLIENTE_ID)
console.log('Cliente field meta:', clienteField)
