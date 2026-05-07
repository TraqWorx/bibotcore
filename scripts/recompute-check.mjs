import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Simulate what recompute sees with the 1000-cap.
const { data: pods } = await sb.from('apulia_contacts').select('codice_amministratore, pod_override, is_switch_out').eq('is_amministratore', false)
console.log(`Pods returned by recompute query (capped): ${pods?.length}`)
const active = (pods ?? []).filter(p => !p.is_switch_out)
console.log(`Active: ${active.length}`)

// Group by codice
const byCode = {}
for (const p of active) {
  const k = p.codice_amministratore ?? '__no_code__'
  byCode[k] = (byCode[k] ?? 0) + 1
}
console.log(`\nPODs under code 44777 (in capped query): ${byCode['44777'] ?? 0}`)
console.log(`PODs under code __no_code__: ${byCode['__no_code__'] ?? 0}`)

// Now paginated for accurate count
let allPods = []
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('apulia_contacts').select('codice_amministratore, pod_override, is_switch_out').eq('is_amministratore', false).range(from, from + 999)
  if (!data?.length) break
  allPods = allPods.concat(data)
  if (data.length < 1000) break
}
console.log(`\nFull paginated pods count: ${allPods.length}`)
const activeAll = allPods.filter(p => !p.is_switch_out)
const byCodeAll = {}
for (const p of activeAll) {
  const k = p.codice_amministratore ?? '__no_code__'
  byCodeAll[k] = (byCodeAll[k] ?? 0) + 1
}
console.log(`PODs under code 44777 (paginated): ${byCodeAll['44777'] ?? 0}`)
