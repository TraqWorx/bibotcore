import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// All admin rows
let all = []
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('apulia_contacts')
    .select('id, ghl_id, sync_status, codice_amministratore, first_name')
    .eq('is_amministratore', true)
    .range(from, from + 999)
  if (!data || data.length === 0) break
  all = all.concat(data)
  if (data.length < 1000) break
}
console.log(`Total admin rows: ${all.length}`)

// Group by codice_amministratore
const byCode = new Map()
for (const a of all) {
  const k = a.codice_amministratore ?? '__null__'
  if (!byCode.has(k)) byCode.set(k, [])
  byCode.get(k).push(a)
}

const dupes = [...byCode.entries()].filter(([_, list]) => list.length > 1)
console.log(`Duplicate codes: ${dupes.length}`)
for (const [code, list] of dupes.slice(0, 5)) {
  console.log(`\n  code=${JSON.stringify(code)}:`)
  for (const r of list) {
    console.log(`    ${r.id} ghl=${r.ghl_id ?? 'null'} sync=${r.sync_status} name=${r.first_name}`)
  }
}

// Check for whitespace/case oddities in stored codes
const oddities = all.filter((a) => a.codice_amministratore && (a.codice_amministratore !== a.codice_amministratore.trim() || a.codice_amministratore.match(/[^0-9A-Z]/i)))
console.log(`\nCodes with weird chars (non-alnum or untrimmed): ${oddities.length}`)
for (const a of oddities.slice(0, 5)) {
  const c = a.codice_amministratore
  console.log(`  ${a.id} code=${JSON.stringify(c)} bytes=${[...c].map(ch => ch.charCodeAt(0)).join(',')}`)
}

console.log(`\nUnique codes: ${byCode.size}`)
console.log(`Pending creates (new from this 2nd upload): ${all.filter(a => a.sync_status === 'pending_create').length}`)
console.log(`Synced (from 1st upload): ${all.filter(a => a.sync_status === 'synced').length}`)
console.log(`Failed: ${all.filter(a => a.sync_status === 'failed').length}`)
