/** Run recomputeCommissions directly via Supabase admin client. */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Pull every admin + every pod with pagination.
const admins = []
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('apulia_contacts')
    .select('id, ghl_id, codice_amministratore, compenso_per_pod, commissione_totale, custom_fields')
    .eq('is_amministratore', true)
    .neq('sync_status', 'pending_delete')
    .range(from, from + 999)
  if (!data?.length) break
  admins.push(...data)
  if (data.length < 1000) break
}
const pods = []
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('apulia_contacts')
    .select('codice_amministratore, pod_override, is_switch_out')
    .eq('is_amministratore', false)
    .neq('sync_status', 'pending_delete')
    .range(from, from + 999)
  if (!data?.length) break
  pods.push(...data)
  if (data.length < 1000) break
}
console.log(`Admins: ${admins.length}, Pods: ${pods.length}`)
const activePods = pods.filter(p => !p.is_switch_out)

const byCode = new Map()
for (const a of admins) {
  if (a.codice_amministratore) byCode.set(a.codice_amministratore, { compenso: Number(a.compenso_per_pod) || 0, total: 0 })
}
for (const p of activePods) {
  if (!p.codice_amministratore) continue
  const e = byCode.get(p.codice_amministratore)
  if (!e) continue
  const ov = Number(p.pod_override) || 0
  e.total += ov > 0 ? ov : e.compenso
}

const APULIA_FIELD_COMMISSIONE_TOTALE = 'EEaur1fU5jr56DhfL2eI'
let updated = 0
for (const a of admins) {
  if (!a.codice_amministratore) continue
  const e = byCode.get(a.codice_amministratore)
  if (!e) continue
  const current = Number(a.commissione_totale) || 0
  if (Math.round(current * 100) === Math.round(e.total * 100)) continue
  const newCf = { ...(a.custom_fields ?? {}), [APULIA_FIELD_COMMISSIONE_TOTALE]: String(e.total) }
  await sb.from('apulia_contacts').update({ commissione_totale: e.total, custom_fields: newCf, sync_status: 'pending_update' }).eq('id', a.id)
  await sb.from('apulia_sync_queue').insert({ contact_id: a.id, ghl_id: a.ghl_id ?? null, action: 'set_field', payload: { fieldId: APULIA_FIELD_COMMISSIONE_TOTALE, value: e.total } })
  updated++
}
console.log(`Updated ${updated} admins.`)
