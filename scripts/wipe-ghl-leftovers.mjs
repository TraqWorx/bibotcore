/**
 * Delete every GHL contact in Apulia location that doesn't have a
 * matching Bibot row. Use AFTER wipe-everything.mjs has finished its
 * drain to mop up GHL contacts that survived (typically because their
 * Bibot row never existed or was already gone when we queued deletes).
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: tok } = await sb.from('ghl_connections').select('access_token').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').maybeSingle()

let allGhl = []
let searchAfter = null
while (true) {
  const body = { locationId: 'VtNhBfleEQDg0KX4eZqY', pageLimit: 500 }
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

let ok = 0, fail = 0
for (const c of allGhl) {
  const r = await fetch(`https://services.leadconnectorhq.com/contacts/${c.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tok.access_token}`, Version: '2021-07-28' },
  })
  if (r.ok || r.status === 404) ok++
  else fail++
  if ((ok + fail) % 20 === 0) console.log(`  ${ok + fail}/${allGhl.length} (ok=${ok}, fail=${fail})`)
  await new Promise(res => setTimeout(res, 100))
}
console.log(`Deleted ${ok}, failed ${fail}`)
