import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const [{ count: total }, { count: admins }, { count: condomini }, { count: switched }] = await Promise.all([
  sb.from('apulia_contacts').select('*', { count: 'exact', head: true }),
  sb.from('apulia_contacts').select('*', { count: 'exact', head: true }).eq('is_amministratore', true),
  sb.from('apulia_contacts').select('*', { count: 'exact', head: true }).eq('is_amministratore', false).eq('is_switch_out', false),
  sb.from('apulia_contacts').select('*', { count: 'exact', head: true }).eq('is_switch_out', true),
])
console.log('Cache totals:')
console.log(`  total:     ${total}`)
console.log(`  admins:    ${admins}`)
console.log(`  condomini: ${condomini}`)
console.log(`  switched:  ${switched}`)

// Now check GHL
const tokenRes = await sb.from('ghl_connections').select('access_token').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').maybeSingle()
if (!tokenRes.data?.access_token) { console.error('No GHL token for Apulia'); process.exit(1) }
const r = await fetch('https://services.leadconnectorhq.com/contacts/search', {
  method: 'POST',
  headers: { Authorization: `Bearer ${tokenRes.data.access_token}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
  body: JSON.stringify({ locationId: 'VtNhBfleEQDg0KX4eZqY', pageLimit: 1 }),
})
const j = await r.json()
console.log(`\nGHL contacts in Apulia location: ${j.total ?? 'unknown'}`)
