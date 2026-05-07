import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Latest PDP import and its ops
const { data: imp } = await sb.from('apulia_imports').select('id, created, updated, skipped, rows_total').eq('kind', 'pdp').order('created_at', { ascending: false }).limit(1).maybeSingle()
console.log('Latest PDP import:', imp)

// Op breakdown for that import
let ops = []
for (let f = 0; ; f += 1000) {
  const { data } = await sb.from('apulia_sync_queue').select('contact_id, action, status, last_error').eq('import_id', imp.id).range(f, f + 999)
  if (!data?.length) break
  ops = ops.concat(data); if (data.length < 1000) break
}
console.log(`Ops for this import: ${ops.length}`)
const byActionStatus = {}
for (const o of ops) {
  const k = `${o.action}:${o.status}`
  byActionStatus[k] = (byActionStatus[k] ?? 0) + 1
}
console.log('By action+status:', byActionStatus)

// Of the create ops, how many contact_ids exist in DB?
const createIds = ops.filter(o => o.action === 'create').map(o => o.contact_id).filter(Boolean)
let inDb = 0
const dbIds = new Set()
for (let i = 0; i < createIds.length; i += 500) {
  const slice = createIds.slice(i, i + 500)
  const { data } = await sb.from('apulia_contacts').select('id').in('id', slice)
  for (const r of data ?? []) { dbIds.add(r.id); inDb++ }
}
const missing = createIds.filter(id => !dbIds.has(id))
console.log(`Create ops contacts: ${createIds.length}, in DB: ${inDb}, missing: ${missing.length}`)

// Sample a few missing contact_ids — what do their queue ops say?
console.log('\nSample 5 missing contact_ids and their ops history:')
for (const id of missing.slice(0, 5)) {
  const { data: opsForC } = await sb.from('apulia_sync_queue').select('id, action, status, attempts, last_error, completed_at').eq('contact_id', id).order('created_at')
  console.log(`\n  ${id.slice(0,8)}:`)
  for (const o of opsForC ?? []) console.log(`    ${o.action}:${o.status} attempts=${o.attempts} err=${(o.last_error ?? '').slice(0, 120)}`)
}

// Also check: failed sync_status condomini?
const [{ count: condFailed }, { count: condTotal }] = await Promise.all([
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('sync_status', 'failed'),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false),
])
console.log({ condTotal, condFailed })
