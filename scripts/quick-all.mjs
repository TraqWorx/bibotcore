import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const [{ count: total }, { count: pending }, { count: pendingDelete }] = await Promise.all([
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }),
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('sync_status', 'pending_delete'),
])
console.log({ totalRows: total, pendingDelete, queuePendingOps: pending })
const { data: tok } = await sb.from('ghl_connections').select('access_token').eq('location_id', 'VtNhBfleEQDg0KX4eZqY').maybeSingle()
const r = await fetch('https://services.leadconnectorhq.com/contacts/search', {
  method: 'POST', headers: { Authorization: `Bearer ${tok.access_token}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
  body: JSON.stringify({ locationId: 'VtNhBfleEQDg0KX4eZqY', pageLimit: 1 }),
})
const j = await r.json()
console.log(`GHL contacts total: ${j.total}`)
