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
  const { data } = await sb.from('apulia_sync_queue').select('contact_id, action, status').eq('action', 'create').gte('created_at', '2026-05-06T13:12:00').range(from, from + 999)
  if (!data?.length) break
  all = all.concat(data)
  if (data.length < 1000) break
}
console.log(`Total create ops: ${all.length}`)

const byContact = new Map()
for (const o of all) {
  if (!byContact.has(o.contact_id)) byContact.set(o.contact_id, [])
  byContact.get(o.contact_id).push(o.status)
}
const dupes = [...byContact.entries()].filter(([_, v]) => v.length > 1)
console.log(`Contact ids with multiple create ops: ${dupes.length}`)
const patterns = new Map()
for (const [cid, statuses] of dupes.slice(0, 100)) {
  const k = statuses.sort().join('+')
  patterns.set(k, (patterns.get(k) ?? 0) + 1)
}
console.log(`\nStatus combo patterns (sample 100):`)
for (const [k, n] of [...patterns.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`)

// Sample 5 dupe contact_ids — are they currently in DB?
const sampleIds = dupes.slice(0, 5).map(d => d[0]).filter(Boolean)
const { data: existing } = await sb.from('apulia_contacts').select('id, is_amministratore, sync_status').in('id', sampleIds)
console.log(`\nSample 5 dupe-op contact_ids:`)
for (const id of sampleIds) {
  const e = (existing ?? []).find(r => r.id === id)
  const ops = byContact.get(id)
  console.log(`  ${id.slice(0,8)} ops=[${ops.join(',')}] in_db=${!!e} ${e ? `admin=${e.is_amministratore} sync=${e.sync_status}` : ''}`)
}
