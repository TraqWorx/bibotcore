import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// All webhooks for "Danlo" or with that contact id
const { data: events } = await sb.from('ghl_webhook_events').select('event_type, received_at, payload').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').gte('received_at', '2026-05-07T08:36:00').order('received_at', { ascending: true }).limit(50)
console.log(`Events since 08:36 today: ${events?.length}`)
for (const e of events ?? []) {
  const p = e.payload ?? {}
  if ((p.firstName ?? '').toLowerCase().includes('dan') || p.id === 'AurqG4Ntgy3MN3FZcKHB') {
    console.log(`  ${e.event_type} at ${e.received_at} firstName=${p.firstName} id=${p.id} tags=${JSON.stringify(p.tags)}`)
  }
}

// Find Danlo in Bibot
const { data: rows } = await sb.from('apulia_contacts').select('id, ghl_id, first_name, tags, sync_status, cached_at').ilike('first_name', '%Danlo%')
console.log('\nDanlo in Bibot:')
for (const r of rows ?? []) console.log(`  id=${r.id.slice(0,8)} ghl=${r.ghl_id} name=${r.first_name} tags=${JSON.stringify(r.tags)} sync=${r.sync_status} cached=${r.cached_at}`)
