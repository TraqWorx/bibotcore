/**
 * Full Apulia reset: back up every table, delete all GHL contacts for the
 * location, hard-delete the cache, and clear the aux tables. For a clean
 * re-import. Reads env from THIS repo (customdash).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const LOC = 'VtNhBfleEQDg0KX4eZqY'
const CONCURRENCY = 10

// 1. Backup.
mkdirSync('backups', { recursive: true })
const ts = new Date().toISOString().replace(/[:.]/g, '-')
async function dump(table) {
  let all = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('*').range(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    all = all.concat(data)
    if (data.length < 1000) break
  }
  const path = `backups/${table}_pre-reimport_${ts}.json`
  writeFileSync(path, JSON.stringify(all, null, 2))
  console.log(`  backup ${table.padEnd(24)} ${String(all.length).padStart(6)} rows`)
}
console.log('1/4 Backup…')
for (const t of ['apulia_contacts', 'apulia_payments', 'apulia_imports', 'apulia_opportunities', 'apulia_sync_queue']) await dump(t)

// 2. Token + collect every GHL id (cache + live GHL search).
const { data: tok } = await sb.from('ghl_connections').select('access_token').eq('location_id', LOC).maybeSingle()
if (!tok?.access_token) { console.error('No GHL token'); process.exit(1) }
const { count: cancelled } = await sb.from('apulia_sync_queue').delete({ count: 'exact' }).in('status', ['pending', 'in_progress', 'failed'])
console.log(`2/4 Cancelled ${cancelled ?? 0} open queue ops.`)

const ghlIds = new Set()
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('apulia_contacts').select('ghl_id').range(from, from + 999).not('ghl_id', 'is', null)
  if (!data?.length) break
  for (const r of data) if (r.ghl_id) ghlIds.add(r.ghl_id)
  if (data.length < 1000) break
}
let searchAfter = null
while (true) {
  const body = { locationId: LOC, pageLimit: 500 }
  if (searchAfter) body.searchAfter = searchAfter
  const r = await fetch('https://services.leadconnectorhq.com/contacts/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok.access_token}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  const batch = j.contacts ?? []
  for (const c of batch) ghlIds.add(c.id)
  if (batch.length < 500) break
  const last = batch[batch.length - 1]
  searchAfter = last.searchAfter ?? last.sortBy ?? null
  if (!searchAfter) break
}
const all = [...ghlIds]
console.log(`3/4 Deleting ${all.length} GHL contacts…`)

let ok = 0, fail = 0, rl = 0
const startedAt = Date.now()
async function worker(slice) {
  for (const id of slice) {
    let attempt = 0
    while (true) {
      const r = await fetch(`https://services.leadconnectorhq.com/contacts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tok.access_token}`, Version: '2021-07-28' },
      })
      if (r.ok || r.status === 404) { ok++; break }
      if (r.status === 429) { rl++; attempt++; if (attempt > 6) { fail++; break } await new Promise((res) => setTimeout(res, 2000 * attempt)); continue }
      fail++; break
    }
    const done = ok + fail
    if (done % 200 === 0) {
      const rate = done / ((Date.now() - startedAt) / 1000)
      console.log(`   ${done}/${all.length}  ok=${ok} fail=${fail} rl=${rl}  ${rate.toFixed(1)}/s  ETA ${Math.round((all.length - done) / rate)}s`)
    }
  }
}
const slices = Array.from({ length: CONCURRENCY }, () => [])
all.forEach((id, i) => slices[i % CONCURRENCY].push(id))
await Promise.all(slices.map(worker))
console.log(`   GHL delete done in ${Math.round((Date.now() - startedAt) / 1000)}s. ok=${ok} fail=${fail} rl=${rl}`)

// 4. Hard-delete cache + clear aux.
const { count: cacheDel } = await sb.from('apulia_contacts').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000')
console.log(`4/4 Hard-deleted ${cacheDel} cache rows.`)
for (const t of ['apulia_payments', 'apulia_imports', 'apulia_opportunities']) {
  await sb.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  const { count } = await sb.from(t).select('*', { count: 'exact', head: true })
  console.log(`   cleared ${t.padEnd(24)} now ${count}`)
}
console.log('\nWIPE COMPLETE.')
