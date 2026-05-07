import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Recent webhook events for Apulia, any type
const { data: events } = await sb.from('ghl_webhook_events').select('event_type, created_at, payload').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').order('created_at', { ascending: false }).limit(10)
console.log(`Total recent Apulia webhooks: ${events?.length}`)
for (const e of events ?? []) {
  const p = e.payload
  console.log(`  ${e.event_type} at ${e.created_at}: contactId=${p?.id ?? p?.contact?.id} tags=${JSON.stringify(p?.tags ?? p?.contact?.tags ?? null)}`)
}

// Also: count by event type
const { data: byType } = await sb.from('ghl_webhook_events').select('event_type').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').gte('created_at', '2026-05-07T00:00:00').limit(2000)
const counts = {}
for (const e of byType ?? []) counts[e.event_type] = (counts[e.event_type] ?? 0) + 1
console.log('\nWebhook events today by type:', counts)
