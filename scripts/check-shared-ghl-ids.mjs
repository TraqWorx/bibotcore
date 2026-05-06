import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// For the 3 stuck admins, find Bibot rows that ALREADY hold the GHL id
// returned for their email (proving the silent-update theory).
const sharedGhlIds = ['lTsC3LjLnz5HSb4JSznx', '21or64RuBC7yE32ZkjBy']
const { data: rows } = await sb
  .from('apulia_contacts')
  .select('id, ghl_id, sync_status, first_name, codice_amministratore, email')
  .in('ghl_id', sharedGhlIds)
console.log('Bibot rows holding the shared ghl_ids:')
for (const r of rows ?? []) {
  console.log(`  ghl=${r.ghl_id} bibot=${r.id} sync=${r.sync_status} name=${r.first_name} code=${r.codice_amministratore} email=${r.email}`)
}

// Group all admins by email; show emails with >1 row.
const { data: all } = await sb.from('apulia_contacts').select('id, ghl_id, first_name, codice_amministratore, email').eq('is_amministratore', true)
const byEmail = new Map()
for (const a of all ?? []) {
  if (!a.email) continue
  if (!byEmail.has(a.email)) byEmail.set(a.email, [])
  byEmail.get(a.email).push(a)
}
const dupesByEmail = [...byEmail.entries()].filter(([_, list]) => list.length > 1)
console.log(`\nEmails shared by multiple admin rows: ${dupesByEmail.length}`)
for (const [email, list] of dupesByEmail.slice(0, 10)) {
  console.log(`  ${email}: ${list.length} rows`)
  for (const r of list) console.log(`    bibot=${r.id} ghl=${r.ghl_id} name=${r.first_name} code=${r.codice_amministratore}`)
}
