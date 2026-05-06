import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Direct counts from apulia_contacts
const [{ count: total }, { count: condTotal }, { count: condActive }, { count: condSwitched }, { count: condFailed }, { count: condPending }, { count: condNoCode }, { count: condWithCode }] = await Promise.all([
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('is_switch_out', false).neq('sync_status', 'pending_delete'),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('is_switch_out', true),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('sync_status', 'failed'),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('sync_status', 'pending_create'),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).is('codice_amministratore', null),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).not('codice_amministratore', 'is', null),
])
console.log({ total, condTotal, condActive, condSwitched, condFailed, condPending, condNoCode, condWithCode })

// RPC output
const { data: counts } = await sb.rpc('apulia_admin_pod_counts')
let rpcActiveSum = 0
let rpcSwitchSum = 0
for (const r of counts ?? []) {
  rpcActiveSum += Number(r.active) || 0
  rpcSwitchSum += Number(r.switched) || 0
}
console.log(`\nRPC apulia_admin_pod_counts: ${counts?.length} admin codes, active sum = ${rpcActiveSum}, switched sum = ${rpcSwitchSum}`)
