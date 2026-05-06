import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
let all = []
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('apulia_contacts').select('id, first_name, codice_amministratore, compenso_per_pod, custom_fields, sync_status').eq('is_amministratore', true).range(from, from + 999)
  if (!data?.length) break
  all = all.concat(data)
  if (data.length < 1000) break
}
console.log(`Total admins: ${all.length}`)
const withCompenso = all.filter(a => a.compenso_per_pod != null && a.compenso_per_pod > 0)
const withoutCompenso = all.filter(a => !a.compenso_per_pod || a.compenso_per_pod <= 0)
console.log(`With compenso_per_pod: ${withCompenso.length}`)
console.log(`Without compenso_per_pod: ${withoutCompenso.length}`)
console.log(`\nFirst 5 admins (any state):`)
for (const a of all.slice(0, 5)) {
  const cfCompenso = a.custom_fields?.['kC4I003OOGX4MyGUw8fj']
  console.log(`  ${a.first_name} (${a.codice_amministratore}) sync=${a.sync_status} column.compenso=${a.compenso_per_pod} cf.compenso=${cfCompenso}`)
}
