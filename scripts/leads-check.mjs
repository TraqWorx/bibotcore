import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: stores } = await sb.from('apulia_stores').select('slug, name, form_id')
console.log('Stores:')
for (const s of stores ?? []) console.log(`  ${s.slug} (${s.name}) form_id=${s.form_id ?? 'NONE'}`)

console.log('\nContacts with any store-* tag:')
const { data: tagged } = await sb.from('apulia_contacts').select('id, first_name, email, tags, cached_at, created_at').filter('tags', 'cs', '{lead}').limit(20)
for (const r of tagged ?? []) console.log(`  ${r.first_name} <${r.email}> tags=${JSON.stringify(r.tags)} cached=${r.cached_at}`)

// All store tags
console.log('\nAny tags starting with "store-":')
let all = []
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('apulia_contacts').select('id, first_name, tags').not('tags', 'is', null).range(from, from + 999)
  if (!data?.length) break
  all = all.concat(data); if (data.length < 1000) break
}
const storeTagMap = new Map()
for (const r of all) {
  for (const t of r.tags ?? []) {
    if (t.startsWith('store-')) storeTagMap.set(t, (storeTagMap.get(t) ?? 0) + 1)
  }
}
for (const [t, n] of storeTagMap) console.log(`  ${t}: ${n} contacts`)

// Recent webhook events
console.log('\nRecent ContactCreate webhook events:')
const { data: events } = await sb.from('ghl_webhook_events').select('event_type, created_at, payload').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').in('event_type', ['ContactCreate', 'ContactUpdate', 'FormSubmitted', 'OptInDone']).order('created_at', { ascending: false }).limit(5)
for (const e of events ?? []) {
  const p = e.payload
  const tags = p?.tags ?? p?.contact?.tags ?? '?'
  console.log(`  ${e.event_type} at ${e.created_at}: id=${p?.id ?? p?.contact?.id} tags=${JSON.stringify(tags)}`)
}
