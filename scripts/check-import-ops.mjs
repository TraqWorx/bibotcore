import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Count ops created at the 10:08 import timestamp
let allOps = []
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('apulia_sync_queue').select('id, contact_id, action, status, created_at, import_id').gte('created_at', '2026-05-06T10:08:00').lt('created_at', '2026-05-06T10:09:00').range(from, from + 999)
  if (!data?.length) break
  allOps = allOps.concat(data)
  if (data.length < 1000) break
}
console.log(`Ops created in 10:08 window: ${allOps.length}`)

const byContact = new Map()
for (const o of allOps) {
  if (!byContact.has(o.contact_id)) byContact.set(o.contact_id, [])
  byContact.get(o.contact_id).push(o)
}
const dupes = [...byContact.entries()].filter(([_, list]) => list.length > 1)
console.log(`Contact ids with multiple ops in this window: ${dupes.length}`)
for (const [cid, list] of dupes.slice(0, 10)) {
  console.log(`  contact ${cid}:`)
  for (const o of list) console.log(`    op ${o.id.slice(0,8)} action=${o.action} status=${o.status}`)
}

// Are there ops with the same contact_id from BOTH imports (09:27 and 10:08)?
console.log('\n--- Ops by import_id ---')
const byImport = new Map()
for (const o of allOps) {
  const k = o.import_id ?? '__no-import-id__'
  byImport.set(k, (byImport.get(k) ?? 0) + 1)
}
for (const [k, n] of byImport) console.log(`  ${k}: ${n} ops`)

// Distinct unique action distribution
console.log('\n--- Action distribution ---')
const byAction = new Map()
for (const o of allOps) byAction.set(o.action, (byAction.get(o.action) ?? 0) + 1)
for (const [a, n] of byAction) console.log(`  ${a}: ${n}`)
