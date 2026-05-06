import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const [{ count: total }, { count: condTotal }, { count: condVisible }, { count: condFailed }, { count: condPendingDelete }, { count: condSwitch }, { count: condActive }, { count: queueTotal }, { count: queuePending }, { count: queueFailed }, { count: queueCompleted }] = await Promise.all([
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).neq('sync_status', 'pending_delete'),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('sync_status', 'failed'),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('sync_status', 'pending_delete'),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('is_switch_out', true),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('is_switch_out', false).neq('sync_status', 'pending_delete'),
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }),
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
])
console.log('Bibot DB:')
console.log({ total, condTotal, condVisibleByListCondomini: condVisible, condFailed, condPendingDelete, condSwitch, condActive })
console.log('Queue:')
console.log({ queueTotal, queuePending, queueFailed, queueCompleted })
