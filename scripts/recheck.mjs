import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: imp } = await sb.from('apulia_imports').select('id').eq('kind', 'pdp').order('created_at', { ascending: false }).limit(1).maybeSingle()

// Pick a random create op contact_id and see if it's in DB
const { data: sample } = await sb.from('apulia_sync_queue').select('contact_id').eq('import_id', imp.id).eq('action', 'create').limit(5)
console.log('Sample contact_ids from queue ops:')
for (const r of sample ?? []) {
  const { data: row } = await sb.from('apulia_contacts').select('id, ghl_id, is_amministratore, pod_pdr').eq('id', r.contact_id).maybeSingle()
  console.log(`  ${r.contact_id?.slice(0,8)} → ${row ? `IN DB pod=${row.pod_pdr} admin=${row.is_amministratore}` : 'NOT FOUND'}`)
}

// Also, are condomini in DB tied to any queue op?
const { data: condomini } = await sb.from('apulia_contacts').select('id').eq('is_amministratore', false).limit(5)
console.log('\nSample condomini id from DB:')
for (const r of condomini ?? []) {
  const { count } = await sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('contact_id', r.id)
  console.log(`  ${r.id.slice(0,8)} → ${count} queue ops`)
}
