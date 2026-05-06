import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const stuckIds = [
  'd06c89b9-d6c4-4b61-9fd1-6644120828d7',
  'b9c2a13e-cef0-447f-bbb8-5e5e4be1d93b',
  '366eac5c-63f7-4691-9ec6-40021f1db852',
]

for (const id of stuckIds) {
  console.log(`\n=== contact ${id} ===`)
  const { data: row } = await sb.from('apulia_contacts').select('*').eq('id', id).maybeSingle()
  console.log(`  name: ${row.first_name}, email: ${row.email}, code: ${row.codice_amministratore}`)
  const { data: ops } = await sb.from('apulia_sync_queue').select('*').eq('contact_id', id).order('created_at', { ascending: true })
  console.log(`  queue ops: ${ops?.length}`)
  for (const op of ops ?? []) {
    console.log(`    - ${op.id.slice(0, 8)} action=${op.action} status=${op.status} attempts=${op.attempts} next=${op.next_attempt_at} err=${(op.last_error ?? '').slice(0, 200)}`)
  }
}

// Also: do GHL contacts exist with these emails (despite no ghl_id stamped)?
const { data: tok } = await sb.from('ghl_connections').select('access_token').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').maybeSingle()
console.log('\n=== Looking up these contacts in GHL by email ===')
for (const id of stuckIds) {
  const { data: row } = await sb.from('apulia_contacts').select('email, first_name, codice_amministratore').eq('id', id).maybeSingle()
  if (!row?.email) {
    console.log(`  ${id}: no email; skipping GHL check`)
    continue
  }
  const r = await fetch('https://services.leadconnectorhq.com/contacts/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok.access_token}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ locationId: 'VtNhBfleEQDg0KX4eZqY', pageLimit: 5, filters: [{ field: 'email', operator: 'eq', value: row.email }] }),
  })
  const j = await r.json()
  console.log(`  ${row.first_name} <${row.email}> code=${row.codice_amministratore}: GHL has ${j.contacts?.length ?? 0} match(es)`)
  for (const c of j.contacts ?? []) console.log(`     ghl=${c.id} firstName=${c.firstName} tags=${c.tags?.join(',')}`)
}
