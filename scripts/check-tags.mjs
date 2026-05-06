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
  const { data } = await sb.from('apulia_contacts').select('id, tags, is_amministratore').range(from, from + 999)
  if (!data?.length) break
  all = all.concat(data)
  if (data.length < 1000) break
}
console.log(`Total rows: ${all.length}`)

const tagCount = new Map()
for (const r of all) {
  for (const t of r.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
}
console.log(`\nTag distribution:`)
for (const [t, n] of [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${JSON.stringify(t)}: ${n}`)
}

// Check if admin rows have the tag
const admins = all.filter(r => r.is_amministratore)
const adminsWithTag = admins.filter(r => (r.tags ?? []).some(t => t.toLowerCase() === 'amministratore'))
const adminsWithoutTag = admins.filter(r => !(r.tags ?? []).some(t => t.toLowerCase() === 'amministratore'))
console.log(`\nAdmins (is_amministratore=true): ${admins.length}`)
console.log(`  With 'amministratore' tag (case-insensitive): ${adminsWithTag.length}`)
console.log(`  Without: ${adminsWithoutTag.length}`)
console.log(`\nFirst 3 admins without the tag:`)
for (const r of adminsWithoutTag.slice(0, 3)) console.log(`  id=${r.id.slice(0,8)} tags=${JSON.stringify(r.tags)}`)
