import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const ids = ['c433fc74-e7e2-4ca3-9c2c-1f1fc16cb5e0', '57a4c793', 'd37a5b19']
const { data: failedOps } = await sb.from('apulia_sync_queue').select('contact_id').eq('status', 'failed').limit(5)
const contactIds = (failedOps ?? []).map(r => r.contact_id).filter(Boolean)
const { data: rows } = await sb.from('apulia_contacts').select('id, is_amministratore, pod_pdr, codice_amministratore, first_name').in('id', contactIds)
console.log('Sample failed-op contacts:')
for (const r of rows ?? []) console.log(`  ${r.id.slice(0,8)} admin=${r.is_amministratore} pod=${r.pod_pdr} code=${r.codice_amministratore} name=${r.first_name}`)
const [{ count: failedTotal }, { count: failedAdmins }, { count: failedCondomini }] = await Promise.all([
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', true).eq('sync_status', 'failed'),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('sync_status', 'failed'),
])
console.log({ failedOpsTotal: failedTotal, failedAdmins, failedCondomini })
