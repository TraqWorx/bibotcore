import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Latest PDP import ops
const { data: imp } = await sb.from('apulia_imports').select('id').eq('kind', 'pdp').order('created_at', { ascending: false }).limit(1).maybeSingle()
let ops = []
for (let f = 0; ; f += 1000) {
  const { data } = await sb.from('apulia_sync_queue').select('contact_id, action, status').eq('import_id', imp.id).range(f, f + 999)
  if (!data?.length) break
  ops = ops.concat(data)
  if (data.length < 1000) break
}
const ids = [...new Set(ops.map(o => o.contact_id).filter(Boolean))]
console.log(`Distinct contact_ids in this PDP import: ${ids.length}`)

// Of those, how many exist in DB
let inDb = 0, missing = 0
for (let i = 0; i < ids.length; i += 500) {
  const slice = ids.slice(i, i + 500)
  const { data } = await sb.from('apulia_contacts').select('id').in('id', slice)
  inDb += data?.length ?? 0
  missing += slice.length - (data?.length ?? 0)
}
console.log(`In DB: ${inDb}, missing: ${missing}`)

// Bibot vs GHL count
const [{ count: bibotCondomini }, { count: bibotAdmins }] = await Promise.all([
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).neq('sync_status', 'pending_delete'),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', true).neq('sync_status', 'pending_delete'),
])
const { data: tok } = await sb.from('ghl_connections').select('access_token').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').maybeSingle()
const r = await fetch('https://services.leadconnectorhq.com/contacts/search', {
  method: 'POST', headers: { Authorization: `Bearer ${tok.access_token}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
  body: JSON.stringify({ locationId: 'VtNhBfleEQDg0KX4eZqY', pageLimit: 1 }),
})
const j = await r.json()
console.log(`Bibot: ${bibotCondomini} condomini + ${bibotAdmins} admins = ${bibotCondomini + bibotAdmins}`)
console.log(`GHL total: ${j.total}`)
