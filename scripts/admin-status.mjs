import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
// Failed admin create ops total
const { count: totalFailed } = await sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('action', 'create').eq('status', 'failed').gte('created_at', '2026-05-06T13:12:00')
console.log(`Total failed create ops since 13:12: ${totalFailed}`)
// Of those, how many are admin failed creates (joined with apulia_contacts to filter is_amministratore)
let allFailed = []
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('apulia_sync_queue').select('contact_id').eq('action', 'create').eq('status', 'failed').gte('created_at', '2026-05-06T13:12:00').range(from, from + 999)
  if (!data?.length) break
  allFailed = allFailed.concat(data)
  if (data.length < 1000) break
}
console.log(`Pulled ${allFailed.length} failed create rows`)
const ids = allFailed.map(r => r.contact_id).filter(Boolean)
let allRows = []
const CHUNK = 500
for (let i = 0; i < ids.length; i += CHUNK) {
  const slice = ids.slice(i, i + CHUNK)
  const { data } = await sb.from('apulia_contacts').select('id, is_amministratore').in('id', slice)
  allRows = allRows.concat(data ?? [])
}
const stillExist = allRows.length
const adminAmong = allRows.filter(r => r.is_amministratore).length
console.log(`Of ${ids.length} failed-create contacts: ${stillExist} still in DB, ${adminAmong} are admins`)
