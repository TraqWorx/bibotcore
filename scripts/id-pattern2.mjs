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
  const { data } = await sb.from('apulia_contacts').select('id, ghl_id, is_amministratore, sync_status').range(from, from + 999)
  if (!data?.length) break
  all = all.concat(data); if (data.length < 1000) break
}
console.log(`Total: ${all.length}`)
const cond = all.filter(r => !r.is_amministratore)
const idEqGhl = cond.filter(r => r.id === r.ghl_id)
const idIsUuid = cond.filter(r => r.id !== r.ghl_id)
const noGhl = cond.filter(r => !r.ghl_id)
console.log(`Condomini: ${cond.length}`)
console.log(`  id==ghl_id (legacy/webhook-inserted): ${idEqGhl.length}`)
console.log(`  id is uuid AND ghl_id stamped: ${cond.filter(r => r.ghl_id && r.id !== r.ghl_id).length}`)
console.log(`  id is uuid AND ghl_id null: ${noGhl.length}`)
console.log('\nSample id==ghl_id condomini:')
for (const r of idEqGhl.slice(0, 3)) console.log(`  id=${r.id.slice(0,8)} ghl_id=${r.ghl_id} sync=${r.sync_status}`)
