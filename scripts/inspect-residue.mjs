import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: rows } = await sb.from('apulia_contacts').select('id, ghl_id, sync_status, codice_amministratore, first_name').eq('is_amministratore', true).eq('sync_status', 'pending_delete')
console.log(`Bibot rows still pending_delete: ${rows?.length ?? 0}`)
for (const r of rows ?? []) console.log(`  ${r.id} ghl=${r.ghl_id} code=${r.codice_amministratore} name=${r.first_name}`)

console.log('\nQueue ops for these contacts:')
for (const r of rows ?? []) {
  const { data: ops } = await sb.from('apulia_sync_queue').select('id, action, status, attempts, next_attempt_at, last_error').eq('contact_id', r.id)
  for (const o of ops ?? []) console.log(`  ${r.first_name}: op=${o.id.slice(0,8)} action=${o.action} status=${o.status} attempts=${o.attempts} next=${o.next_attempt_at} err=${(o.last_error ?? '').slice(0, 100)}`)
}

console.log('\nQueue overall:')
const [{ count: pending }, { count: failed }, { count: completed }] = await Promise.all([
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
])
console.log({ pending, failed, completed })
