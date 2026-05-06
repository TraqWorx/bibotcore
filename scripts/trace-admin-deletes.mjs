/**
 * Find every queue op tagged with the latest admin import_id, then
 * cross-reference to apulia_contacts to see how many of those admin
 * rows are still in the DB. The delta = admins that got deleted.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: latestAdminImport } = await sb.from('apulia_imports').select('id, kind, filename, created_at').eq('kind', 'admins').order('created_at', { ascending: false }).limit(1).maybeSingle()
if (!latestAdminImport) { console.log('No admin import.'); process.exit() }
console.log(`Latest admins import: ${latestAdminImport.id.slice(0,8)} ${latestAdminImport.filename} ${latestAdminImport.created_at}`)

let allOps = []
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('apulia_sync_queue').select('id, contact_id, action, status, last_error, completed_at').eq('import_id', latestAdminImport.id).range(from, from + 999)
  if (!data?.length) break
  allOps = allOps.concat(data)
  if (data.length < 1000) break
}
console.log(`\nOps tagged to this admin import: ${allOps.length}`)
const byStatus = {}
for (const o of allOps) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1
console.log('By status:', byStatus)

// Cross-check: for each admin op's contact_id, does the row still exist?
const ids = allOps.map(o => o.contact_id).filter(Boolean)
let existing = []
for (let i = 0; i < ids.length; i += 500) {
  const { data } = await sb.from('apulia_contacts').select('id, is_amministratore, sync_status').in('id', ids.slice(i, i + 500))
  existing = existing.concat(data ?? [])
}
const existingIds = new Set(existing.map(r => r.id))
const missing = ids.filter(id => !existingIds.has(id))
console.log(`\nOf ${ids.length} admin contact_ids:`)
console.log(`  Still in DB: ${existing.length}`)
console.log(`  GONE: ${missing.length}`)
console.log(`  Of those in DB, still admins: ${existing.filter(r => r.is_amministratore).length}`)
console.log(`  Of those in DB, are condomini: ${existing.filter(r => !r.is_amministratore).length}`)

// For the missing ones, look at their op statuses
const missingSet = new Set(missing)
const missingOps = allOps.filter(o => missingSet.has(o.contact_id))
const missingByStatus = {}
for (const o of missingOps) missingByStatus[o.status] = (missingByStatus[o.status] ?? 0) + 1
console.log(`\nMissing admin ops by status:`, missingByStatus)
console.log(`\nSample missing op errors:`)
for (const o of missingOps.slice(0, 5)) console.log(`  contact ${o.contact_id?.slice(0,8)} action=${o.action} status=${o.status} err=${(o.last_error ?? '').slice(0, 200)}`)
