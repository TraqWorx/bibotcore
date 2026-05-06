import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const [{ count: pending }, { count: inProgress }, { count: failed }, { count: completed }] = await Promise.all([
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
])
console.log('Queue counts:', { pending, inProgress, failed, completed })

console.log('\nFirst 10 failed ops (with error):')
const { data: failures } = await sb
  .from('apulia_sync_queue')
  .select('id, contact_id, ghl_id, action, attempts, last_error, created_at')
  .eq('status', 'failed')
  .order('created_at', { ascending: true })
  .limit(10)
for (const f of failures ?? []) {
  console.log(`---`)
  console.log(`op ${f.id}`)
  console.log(`  contact: ${f.contact_id} ghl_id=${f.ghl_id ?? 'null'} action=${f.action} attempts=${f.attempts}`)
  console.log(`  error: ${(f.last_error ?? '').slice(0, 400)}`)
}

console.log('\nFirst 5 admin rows post-import:')
const { data: admins } = await sb
  .from('apulia_contacts')
  .select('id, ghl_id, sync_status, codice_amministratore, first_name, custom_fields')
  .eq('is_amministratore', true)
  .order('id', { ascending: false })
  .limit(5)
for (const a of admins ?? []) {
  console.log(`  ${a.id} ghl_id=${a.ghl_id ?? 'null'} sync=${a.sync_status} code=${a.codice_amministratore} name=${a.first_name}`)
  console.log(`    cf keys: ${Object.keys(a.custom_fields ?? {}).join(',')}`)
}
