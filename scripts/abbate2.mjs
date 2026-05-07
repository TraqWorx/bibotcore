import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: admin } = await sb.from('apulia_contacts').select('id, custom_fields, codice_amministratore').eq('codice_amministratore', '44777').eq('is_amministratore', true).maybeSingle()
console.log('CF compenso (kC4I003OOGX4MyGUw8fj):', admin?.custom_fields?.['kC4I003OOGX4MyGUw8fj'])
console.log('CF commissione_totale (EEaur1fU5jr56DhfL2eI):', admin?.custom_fields?.['EEaur1fU5jr56DhfL2eI'])

// Now check the count of OTHER condomini that share code 44777 — maybe duplicates
const { count: matchCount } = await sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('codice_amministratore', '44777').eq('is_amministratore', false)
console.log(`Total condomini with codice_amministratore=44777 (regardless of sync_status): ${matchCount}`)

// And how many are in PODs under this admin (active)?
const { data: pods } = await sb.from('apulia_contacts').select('id, pod_pdr, pod_override, sync_status, is_switch_out').eq('codice_amministratore', '44777').eq('is_amministratore', false).neq('sync_status', 'pending_delete')
console.log(`Filtered: ${pods?.length}`)
const overrideValues = (pods ?? []).map(p => Number(p.pod_override)).filter(v => v > 0)
console.log(`Override values sample: ${overrideValues.slice(0, 5).join(', ')} ... (${overrideValues.length} total)`)
