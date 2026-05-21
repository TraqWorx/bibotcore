/**
 * Faster: skip the queue, delete directly from GHL with concurrency,
 * then hard-delete the cache rows. Cancels any open queue ops first.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const LOC = 'VtNhBfleEQDg0KX4eZqY'
const CONCURRENCY = 8

const { data: tok } = await sb.from('ghl_connections').select('access_token').eq('location_id', LOC).maybeSingle()
if (!tok?.access_token) { console.error('No GHL token for Apulia'); process.exit(1) }

// 1. Cancel any open queue ops so the cron drain and us don't fight.
const { count: cancelled } = await sb.from('apulia_sync_queue').delete({ count: 'exact' }).in('status', ['pending','in_progress','failed'])
console.log(`Cancelled ${cancelled ?? 0} open queue ops.`)

// 2. Collect every ghl_id that still has a row in the cache (or queue, in case some got hard-deleted in cache).
const ghlIds = new Set()
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('apulia_contacts').select('ghl_id').range(from, from + 999).not('ghl_id','is',null)
  if (!data?.length) break
  for (const r of data) if (r.ghl_id) ghlIds.add(r.ghl_id)
  if (data.length < 1000) break
}
console.log(`Cache has ${ghlIds.size} ghl_ids to delete.`)

// 3. Also list everything currently in GHL — covers any ghl-only leftovers.
let searchAfter = null
let ghlSeen = 0
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
  ghlSeen += batch.length
  if (batch.length < 500) break
  const last = batch[batch.length - 1]
  searchAfter = last.searchAfter ?? last.sortBy ?? null
  if (!searchAfter) break
}
console.log(`GHL search returned ${ghlSeen} contacts; combined unique to delete: ${ghlIds.size}.`)

const all = [...ghlIds]
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
      if (r.status === 429) {
        rl++
        attempt++
        if (attempt > 6) { fail++; break }
        await new Promise((res) => setTimeout(res, 2000 * attempt))
        continue
      }
      fail++
      break
    }
    const done = ok + fail
    if (done % 100 === 0) {
      const rate = done / ((Date.now() - startedAt) / 1000)
      const remaining = (all.length - done) / rate
      console.log(`  ${done}/${all.length}  ok=${ok}  fail=${fail}  rl=${rl}  ${rate.toFixed(1)}/s  ETA ${Math.round(remaining)}s`)
    }
  }
}

const slices = Array.from({ length: CONCURRENCY }, () => [])
all.forEach((id, i) => slices[i % CONCURRENCY].push(id))
await Promise.all(slices.map(worker))
const elapsed = Math.round((Date.now() - startedAt) / 1000)
console.log(`\nDone in ${elapsed}s. ok=${ok}  fail=${fail}  rl-hits=${rl}`)

// 4. Hard-delete every cache row (regardless of sync_status).
const { error: delErr, count: delCount } = await sb.from('apulia_contacts').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000')
if (delErr) console.error('Cache delete error:', delErr)
else console.log(`Hard-deleted ${delCount} cache rows.`)
