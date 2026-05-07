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
  const { data } = await sb.from('apulia_contacts').select('id, ghl_id, is_amministratore').range(from, from + 999)
  if (!data?.length) break
  all = all.concat(data)
  if (data.length < 1000) break
}
const condomini = all.filter(r => !r.is_amministratore)
const idEqGhl = condomini.filter(r => r.id === r.ghl_id)
const idIsUuid = condomini.filter(r => r.id !== r.ghl_id)
console.log(`Condomini total: ${condomini.length}`)
console.log(`  id == ghl_id (legacy/webhook-inserted): ${idEqGhl.length}`)
console.log(`  id is uuid (Bibot-minted): ${idIsUuid.length}`)
