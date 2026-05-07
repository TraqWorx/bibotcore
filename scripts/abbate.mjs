import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: admin } = await sb.from('apulia_contacts').select('id, codice_amministratore, compenso_per_pod, commissione_totale, custom_fields').eq('is_amministratore', true).ilike('first_name', '%ABBATE PASQUALE%').maybeSingle()
console.log('Admin:')
console.log({ id: admin?.id?.slice(0,8), codice: admin?.codice_amministratore, compenso_per_pod: admin?.compenso_per_pod, commissione_totale: admin?.commissione_totale })

if (admin?.codice_amministratore) {
  const { data: pods } = await sb.from('apulia_contacts').select('id, pod_pdr, pod_override, is_switch_out').eq('codice_amministratore', admin.codice_amministratore).eq('is_amministratore', false).neq('sync_status', 'pending_delete')
  console.log(`\nPODs under this admin: ${pods?.length}`)
  const active = (pods ?? []).filter(p => !p.is_switch_out)
  const overrides = active.map(p => Number(p.pod_override) || 0)
  const overrideSum = overrides.reduce((s, v) => s + v, 0)
  const overrideCount = overrides.filter(v => v > 0).length
  console.log(`  Active (non-switch_out): ${active.length}`)
  console.log(`  PODs with override>0: ${overrideCount}, sum of overrides: ${overrideSum}`)
  const cp = Number(admin.compenso_per_pod) || 0
  console.log(`  Default compenso: ${cp}`)
  const expected = active.reduce((s, p) => s + ((Number(p.pod_override) || 0) > 0 ? Number(p.pod_override) : cp), 0)
  console.log(`  Expected total: ${expected}`)
}
