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
  const { data } = await sb.from('apulia_contacts').select('id, sync_status, codice_amministratore, first_name, cached_at').eq('is_amministratore', true).range(from, from + 999)
  if (!data?.length) break
  all = all.concat(data)
  if (data.length < 1000) break
}
console.log(`Total: ${all.length}`)
all.sort((a, b) => (a.cached_at ?? '').localeCompare(b.cached_at ?? ''))
console.log(`Earliest cached_at: ${all[0]?.cached_at}`)
console.log(`Latest cached_at: ${all[all.length - 1]?.cached_at}`)

const byBucket = {}
for (const r of all) {
  const bucket = (r.cached_at ?? 'NULL').slice(0, 19)
  if (!byBucket[bucket]) byBucket[bucket] = { synced: 0, pending_create: 0, other: 0 }
  if (r.sync_status === 'synced') byBucket[bucket].synced++
  else if (r.sync_status === 'pending_create') byBucket[bucket].pending_create++
  else byBucket[bucket].other++
}
console.log('\nRows per cached_at minute:')
for (const [k, v] of Object.entries(byBucket).sort()) {
  console.log(`  ${k}  synced=${v.synced} pending_create=${v.pending_create} other=${v.other}`)
}

console.log('\nSamples of "synced" rows (first 3):')
const synced = all.filter((r) => r.sync_status === 'synced')
for (const r of synced.slice(0, 3)) console.log(`  ${r.id} code=${r.codice_amministratore} cached=${r.cached_at} name=${r.first_name}`)
console.log('\nSamples of "pending_create" rows (first 3):')
const pc = all.filter((r) => r.sync_status === 'pending_create')
for (const r of pc.slice(0, 3)) console.log(`  ${r.id} code=${r.codice_amministratore} cached=${r.cached_at} name=${r.first_name}`)
