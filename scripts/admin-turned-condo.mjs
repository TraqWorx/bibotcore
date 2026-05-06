import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Latest admins import
const { data: latestImport } = await sb.from('apulia_imports').select('id').eq('kind', 'admins').order('created_at', { ascending: false }).limit(1).maybeSingle()
const { data: ops } = await sb.from('apulia_sync_queue').select('contact_id').eq('import_id', latestImport.id).limit(5)
const ids = ops.map(o => o.contact_id).filter(Boolean)

console.log(`Sample 5 admin contact_ids — current state:`)
for (const id of ids) {
  const { data: row } = await sb.from('apulia_contacts').select('id, is_amministratore, codice_amministratore, pod_pdr, first_name, tags').eq('id', id).maybeSingle()
  console.log(`\n  ${id.slice(0,8)}`)
  console.log(`    name: ${row.first_name}`)
  console.log(`    is_amministratore: ${row.is_amministratore}`)
  console.log(`    codice: ${row.codice_amministratore}`)
  console.log(`    pod_pdr: ${row.pod_pdr}`)
  console.log(`    tags: ${JSON.stringify(row.tags)}`)
}
