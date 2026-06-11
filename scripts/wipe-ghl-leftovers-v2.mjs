import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const LOC = 'VtNhBfleEQDg0KX4eZqY'
const { data: tok } = await sb.from('ghl_connections').select('access_token').eq('location_id', LOC).maybeSingle()

const allGhl = []
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
  allGhl.push(...batch)
  if (batch.length < 500) break
  const last = batch[batch.length - 1]
  searchAfter = last.searchAfter ?? last.sortBy ?? null
  if (!searchAfter) break
}
console.log(`GHL contacts to delete: ${allGhl.length}`)
if (allGhl.length === 0) process.exit(0)

let ok = 0, fail = 0
const failures = []

for (const c of allGhl) {
  let attempt = 0
  let success = false
  while (attempt < 8) {
    const r = await fetch(`https://services.leadconnectorhq.com/contacts/${c.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tok.access_token}`, Version: '2021-07-28' },
    })
    if (r.ok || r.status === 404) { ok++; success = true; break }
    if (r.status === 429) {
      const wait = 1500 * (attempt + 1)
      await new Promise(res => setTimeout(res, wait))
      attempt++
      continue
    }
    // log the error body once
    const body = await r.text().catch(() => '')
    failures.push({ id: c.id, status: r.status, body: body.slice(0, 200) })
    fail++
    break
  }
  if (!success && attempt >= 8) {
    failures.push({ id: c.id, status: 'rate-limited-out', body: '' })
    fail++
  }
  if ((ok + fail) % 20 === 0) console.log(`  ${ok + fail}/${allGhl.length}  ok=${ok}  fail=${fail}`)
  await new Promise(res => setTimeout(res, 250))
}
console.log(`\nDone. ok=${ok}  fail=${fail}`)
if (failures.length) {
  console.log('First 5 failures:')
  console.log(JSON.stringify(failures.slice(0, 5), null, 2))
}
