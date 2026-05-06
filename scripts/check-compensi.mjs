import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Replicate settings page Compensi calculation
const { data: admins } = await sb.from('apulia_contacts').select('id, codice_amministratore, compenso_per_pod, commissione_totale, sync_status').eq('is_amministratore', true).neq('sync_status', 'pending_delete')
const { data: counts } = await sb.rpc('apulia_admin_pod_counts')
const podCountMap = new Map((counts ?? []).map(r => [r.codice_amministratore, Number(r.active)]))

let totalActive = 0
let withCompenso = 0
let compensoSum = 0
for (const a of admins ?? []) {
  const podsActive = podCountMap.get(a.codice_amministratore ?? '') ?? 0
  totalActive += podsActive
  const cp = Number(a.compenso_per_pod) || 0
  if (cp > 0) {
    withCompenso++
    compensoSum += cp
  }
}
console.log({
  adminRowsInDb: admins?.length,
  rpcAdminCodes: counts?.length,
  totalActiveFromCompensi: totalActive,
  rpcActiveSum: [...podCountMap.values()].reduce((s, v) => s + v, 0),
  adminsWithCompenso: withCompenso,
  avgCompenso: withCompenso ? (compensoSum / withCompenso).toFixed(2) : 0,
})

// Admins that have RPC entries but no admin row
const adminCodesInDb = new Set((admins ?? []).map(a => a.codice_amministratore).filter(Boolean))
const orphanCodes = [...podCountMap.entries()].filter(([code]) => !adminCodesInDb.has(code))
console.log(`\nAdmin codes referenced by condomini but NO admin row in DB: ${orphanCodes.length}`)
let orphanActiveSum = 0
for (const [code, n] of orphanCodes) orphanActiveSum += n
console.log(`POD attivi orphaned (sum): ${orphanActiveSum}`)
