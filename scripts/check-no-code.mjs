import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

console.log('Sample condomini WITHOUT codice_amministratore:')
const { data: noCodeRows } = await sb.from('apulia_contacts').select('id, pod_pdr, first_name, custom_fields, codice_amministratore').eq('is_amministratore', false).is('codice_amministratore', null).limit(5)
for (const r of noCodeRows ?? []) {
  const cfCode = r.custom_fields?.['3VwwjdaKH8oQgUO1Vwih']
  const cfName = r.custom_fields?.['z1HlsBxzFtHaCaZ01KnT']
  console.log(`  pod=${r.pod_pdr} name=${r.first_name} cf.codice=${cfCode} cf.amm_name=${cfName}`)
  console.log(`  cf keys: ${Object.keys(r.custom_fields ?? {}).join(', ')}`)
}

console.log('\nSample condomini WITH codice_amministratore:')
const { data: withCodeRows } = await sb.from('apulia_contacts').select('id, pod_pdr, first_name, custom_fields, codice_amministratore').eq('is_amministratore', false).not('codice_amministratore', 'is', null).limit(3)
for (const r of withCodeRows ?? []) {
  const cfCode = r.custom_fields?.['3VwwjdaKH8oQgUO1Vwih']
  console.log(`  pod=${r.pod_pdr} name=${r.first_name} column.codice=${r.codice_amministratore} cf.codice=${cfCode}`)
}
