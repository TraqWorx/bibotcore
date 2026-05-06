import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
// Pull all admin rows with explicit pagination
let all = []
let from = 0
while (true) {
  const { data } = await sb.from('apulia_contacts').select('id, codice_amministratore, first_name, ghl_id, sync_status').eq('is_amministratore', true).range(from, from + 999)
  if (!data || data.length === 0) break
  all = all.concat(data)
  if (data.length < 1000) break
  from += 1000
}
console.log(`Total admin rows: ${all.length}`)

const byCode = new Map()
for (const a of all) {
  if (!a.codice_amministratore) continue
  if (!byCode.has(a.codice_amministratore)) byCode.set(a.codice_amministratore, [])
  byCode.get(a.codice_amministratore).push(a)
}
const dupes = [...byCode.entries()].filter(([_, list]) => list.length > 1)
console.log(`Duplicate codes: ${dupes.length}`)
for (const [code, list] of dupes) {
  console.log(`  code=${code}:`)
  for (const r of list) console.log(`    ${r.id} ghl=${r.ghl_id} sync=${r.sync_status} name=${r.first_name}`)
}
