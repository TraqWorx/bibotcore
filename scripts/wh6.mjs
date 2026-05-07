import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
// Recent contact events
const { data } = await sb.from('ghl_webhook_events').select('event_type, received_at, payload').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').in('event_type', ['ContactCreate', 'ContactUpdate', 'FormSubmitted', 'FormSubmission', 'OptInDone', 'NoteUpdate']).order('received_at', { ascending: false }).limit(10)
console.log(`Recent contact-related: ${data?.length}`)
for (const e of data ?? []) {
  const p = e.payload ?? {}
  const tags = p.tags ?? p?.contact?.tags ?? null
  console.log(`  ${e.event_type} at ${e.received_at}: name=${p.firstName ?? '?'} tags=${JSON.stringify(tags)}`)
}
