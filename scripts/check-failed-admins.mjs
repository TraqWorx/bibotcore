import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await sb.from('apulia_contacts').select('id, first_name, codice_amministratore, email, sync_error').eq('is_amministratore', true).eq('sync_status', 'failed')
console.log(`Failed admins: ${data?.length}`)
for (const r of data ?? []) {
  console.log(`\n  ${r.first_name} (code ${r.codice_amministratore}) email=${r.email}`)
  console.log(`    err: ${(r.sync_error ?? '').slice(0, 250)}`)
}
