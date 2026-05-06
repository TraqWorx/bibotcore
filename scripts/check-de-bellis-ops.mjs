import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const ids = [
  'a70b0b10-7127-4f75-bc36-772851dd006e',  // DE BELLIS pending
  '943912f6-20e7-454e-9525-977ff32d21f7',  // DE BELLIS synced
  'f0096ee9-a81c-45d5-bd0b-05ea413e7715',  // CANZANO SILVESTRO pending
  '3d0c538f-fb80-498c-9f64-8c78c1bf3272',  // CANZANO SILVESTRO synced
]
for (const id of ids) {
  const { data: row } = await sb.from('apulia_contacts').select('id, first_name, codice_amministratore, custom_fields, sync_status').eq('id', id).maybeSingle()
  if (!row) { console.log(`${id}: NOT FOUND`); continue }
  console.log(`\n${id}:`)
  console.log(`  name=${row.first_name}`)
  console.log(`  column code=${JSON.stringify(row.codice_amministratore)} chars=[${[...(row.codice_amministratore ?? '')].map(c=>c.charCodeAt(0)).join(',')}]`)
  const cfCode = row.custom_fields?.['3VwwjdaKH8oQgUO1Vwih']
  console.log(`  cf code=${JSON.stringify(cfCode)} chars=[${[...(cfCode ?? '')].map(c=>c.charCodeAt(0)).join(',')}]`)
  console.log(`  sync=${row.sync_status}`)
  const { data: ops } = await sb.from('apulia_sync_queue').select('id, action, status, created_at').eq('contact_id', id).order('created_at')
  for (const op of ops ?? []) console.log(`    op ${op.id.slice(0,8)} action=${op.action} status=${op.status} created=${op.created_at}`)
}
