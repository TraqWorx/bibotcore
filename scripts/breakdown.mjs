import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: imp } = await sb.from('apulia_imports').select('id').eq('kind', 'pdp').order('created_at', { ascending: false }).limit(1).maybeSingle()
let ops = []
for (let f = 0; ; f += 1000) {
  const { data } = await sb.from('apulia_sync_queue').select('action, contact_id').eq('import_id', imp.id).range(f, f + 999)
  if (!data?.length) break
  ops = ops.concat(data)
  if (data.length < 1000) break
}
const byAction = {}
for (const o of ops) byAction[o.action] = (byAction[o.action] ?? 0) + 1
console.log(`Total ops for this PDP import: ${ops.length}`)
console.log('By action:', byAction)

// How many distinct contact_ids — i.e., how many actual contacts touched
const distinctContacts = new Set(ops.map(o => o.contact_id).filter(Boolean))
console.log(`Distinct contacts touched: ${distinctContacts.size}`)

// Of those, how many are admins now
const ids = [...distinctContacts]
let admins = 0, condomini = 0, missing = 0
for (let i = 0; i < ids.length; i += 500) {
  const { data } = await sb.from('apulia_contacts').select('id, is_amministratore').in('id', ids.slice(i, i + 500))
  for (const id of ids.slice(i, i + 500)) {
    const r = (data ?? []).find(x => x.id === id)
    if (!r) missing++
    else if (r.is_amministratore) admins++
    else condomini++
  }
}
console.log(`Of those: admins=${admins}, condomini=${condomini}, missing=${missing}`)
