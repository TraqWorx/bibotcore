import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: tok } = await sb.from('ghl_connections').select('access_token').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').maybeSingle()
const r = await fetch('https://services.leadconnectorhq.com/contacts/search', {
  method: 'POST',
  headers: { Authorization: `Bearer ${tok.access_token}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
  body: JSON.stringify({ locationId: 'VtNhBfleEQDg0KX4eZqY', pageLimit: 10 }),
})
const j = await r.json()
console.log(`GHL has ${j.contacts?.length} contacts:`)
for (const c of j.contacts ?? []) {
  console.log(`  id=${c.id} firstName=${c.firstName} email=${c.email} tags=${(c.tags ?? []).join(',')}`)
  // Try delete
  const d = await fetch(`https://services.leadconnectorhq.com/contacts/${c.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok.access_token}`, Version: '2021-07-28' } })
  console.log(`    delete: ${d.status} ${d.ok ? 'OK' : await d.text().then(t => t.slice(0, 200))}`)
}
