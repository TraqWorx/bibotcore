import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: rows } = await sb.from('apulia_contacts').select('*').order('id', { ascending: false }).limit(5)
console.log('Latest rows:')
for (const r of rows ?? []) {
  console.log({
    id: r.id,
    ghl_id: r.ghl_id,
    sync_status: r.sync_status,
    pod_pdr: r.pod_pdr,
    cliente: r.cliente,
    is_amministratore: r.is_amministratore,
    custom_fields_keys: Object.keys(r.custom_fields ?? {}),
    custom_fields: r.custom_fields,
  })
}
const { data: queue } = await sb.from('apulia_sync_queue').select('*').order('created_at', { ascending: false }).limit(5)
console.log('\nLatest queue ops:')
for (const o of queue ?? []) {
  console.log({ id: o.id, contact_id: o.contact_id, ghl_id: o.ghl_id, action: o.action, status: o.status, attempts: o.attempts, last_error: o.last_error?.slice(0, 200) })
}
