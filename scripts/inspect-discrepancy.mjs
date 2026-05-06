import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

console.log('=== Bibot admin row inventory ===')
const { data: admins } = await sb
  .from('apulia_contacts')
  .select('id, ghl_id, sync_status, codice_amministratore, first_name, email')
  .eq('is_amministratore', true)
  .order('first_name')

const total = admins?.length ?? 0
const synced = admins?.filter((a) => a.sync_status === 'synced').length ?? 0
const pending = admins?.filter((a) => a.sync_status?.startsWith('pending_')).length ?? 0
const failed = admins?.filter((a) => a.sync_status === 'failed').length ?? 0
const noGhlId = admins?.filter((a) => !a.ghl_id).length ?? 0

console.log({ total, synced, pending, failed, noGhlId })

console.log('\nAdmins with no ghl_id (still in-flight or stuck):')
for (const a of (admins ?? []).filter((x) => !x.ghl_id)) {
  console.log(`  ${a.id} sync=${a.sync_status} code=${a.codice_amministratore} name=${a.first_name} email=${a.email}`)
}

console.log('\nAdmins with sync_status != synced:')
for (const a of (admins ?? []).filter((x) => x.sync_status !== 'synced')) {
  console.log(`  ${a.id} sync=${a.sync_status} code=${a.codice_amministratore} name=${a.first_name}`)
}

// Duplicate detection by ghl_id (shouldn't happen due to unique index, but verify)
const ghlIds = new Map()
for (const a of admins ?? []) {
  if (!a.ghl_id) continue
  if (!ghlIds.has(a.ghl_id)) ghlIds.set(a.ghl_id, [])
  ghlIds.get(a.ghl_id).push(a)
}
const dupes = [...ghlIds.entries()].filter(([_, rows]) => rows.length > 1)
console.log(`\nDuplicate ghl_id rows: ${dupes.length}`)
for (const [gid, rows] of dupes) {
  console.log(`  ghl_id=${gid}: ${rows.length} rows`)
  for (const r of rows) console.log(`    - ${r.id} ${r.first_name} ${r.codice_amministratore}`)
}

// Check GHL side
console.log('\n=== GHL side ===')
const { data: tok } = await sb.from('ghl_connections').select('access_token').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').maybeSingle()

const allGhl = []
let searchAfter = null
while (true) {
  const body = { locationId: 'VtNhBfleEQDg0KX4eZqY', pageLimit: 500, filters: [{ field: 'tags', operator: 'eq', value: 'amministratore' }] }
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

const ghlAdmins = allGhl.filter((c) => c.tags?.includes('amministratore'))
console.log(`GHL admins (with amministratore tag): ${ghlAdmins.length}`)

// Find ghl_ids in Bibot that aren't in GHL
const ghlIdSet = new Set(ghlAdmins.map((c) => c.id))
const bibotGhlIds = new Set(admins?.filter((a) => a.ghl_id).map((a) => a.ghl_id))
const inBibotNotGhl = [...bibotGhlIds].filter((id) => !ghlIdSet.has(id))
const inGhlNotBibot = ghlAdmins.filter((c) => !bibotGhlIds.has(c.id))
console.log(`In Bibot (with ghl_id) but not in GHL: ${inBibotNotGhl.length}`)
inBibotNotGhl.forEach((id) => {
  const a = admins.find((x) => x.ghl_id === id)
  console.log(`  ghl_id=${id} bibot=${a?.id} name=${a?.first_name} code=${a?.codice_amministratore}`)
})
console.log(`In GHL but not in Bibot: ${inGhlNotBibot.length}`)
inGhlNotBibot.forEach((c) => console.log(`  ghl_id=${c.id} name=${c.firstName}`))
