import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// All delete ops since 13:12
const { count: deleteOpsTotal } = await sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('action', 'delete').gte('created_at', '2026-05-06T13:12:00')
console.log(`Total delete ops since 13:12: ${deleteOpsTotal}`)

// Sample
const { data: deletes } = await sb.from('apulia_sync_queue').select('id, contact_id, ghl_id, status, created_at').eq('action', 'delete').gte('created_at', '2026-05-06T13:12:00').limit(5)
console.log(`\nSample delete ops:`)
for (const r of deletes ?? []) console.log(`  ${r.id.slice(0,8)} contact=${r.contact_id?.slice(0,8)} ghl=${r.ghl_id} status=${r.status} created=${r.created_at}`)

// Where does the contact_id show up that no longer exists?
// Look at COMPLETED create ops that no longer have a contact row (case-A deletions)
const { data: completedCreates } = await sb.from('apulia_sync_queue').select('contact_id').eq('action', 'create').eq('status', 'completed').gte('created_at', '2026-05-06T13:12:00').limit(2000)
console.log(`\nCompleted create ops sample: ${completedCreates?.length}`)
const ids = completedCreates.map(r => r.contact_id).filter(Boolean)
let allRows = []
for (let i = 0; i < ids.length; i += 500) {
  const { data } = await sb.from('apulia_contacts').select('id').in('id', ids.slice(i, i + 500))
  allRows = allRows.concat(data ?? [])
}
console.log(`Of ${ids.length} completed-create contacts: ${allRows.length} still in DB, ${ids.length - allRows.length} deleted (likely case-A)`)
