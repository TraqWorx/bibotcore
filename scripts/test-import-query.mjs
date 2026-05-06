import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Get all unique codes from current admin rows (this is what the file has)
let all = []
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('apulia_contacts').select('codice_amministratore').eq('is_amministratore', true).range(from, from + 999)
  if (!data?.length) break
  all = all.concat(data)
  if (data.length < 1000) break
}
const codes = [...new Set(all.map((r) => r.codice_amministratore).filter(Boolean))]
console.log(`Unique codes from current DB: ${codes.length}`)

// Reproduce the importAdmins query exactly:
const { data: existing } = await sb
  .from('apulia_contacts')
  .select('id, ghl_id, codice_amministratore, custom_fields, tags')
  .eq('is_amministratore', true)
  .in('codice_amministratore', codes)
console.log(`Query returned: ${existing?.length} rows`)

// Sample of returned codes vs input codes
const returnedCodes = new Set((existing ?? []).map((r) => r.codice_amministratore))
const missing = codes.filter((c) => !returnedCodes.has(c))
console.log(`Codes in input but NOT in query result: ${missing.length}`)
console.log(`First 5 missing:`, missing.slice(0, 5))

// Test a synced one — does the .in() include it?
const synced = all.find((r) => r.codice_amministratore === '14407432')
console.log(`\n14407432 sample row in initial pull?`, !!synced)
const test = await sb.from('apulia_contacts').select('id, codice_amministratore, sync_status').eq('is_amministratore', true).eq('codice_amministratore', '14407432')
console.log(`Direct .eq query for 14407432 returned: ${test.data?.length} rows`)
for (const r of test.data ?? []) console.log(`  ${r.id} sync=${r.sync_status}`)
