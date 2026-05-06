import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data } = await sb.from('apulia_imports').select('id, kind, status, filename, rows_total, progress_done, created, updated, skipped, created_at, finished_at, error_msg').eq('kind', 'admins').order('created_at', { ascending: false }).limit(10)
console.log('All admins imports:')
for (const r of data ?? []) {
  console.log({ id: r.id.slice(0, 8), status: r.status, filename: r.filename, rows: r.rows_total, done: r.progress_done, created: r.created, updated: r.updated, skipped: r.skipped, started: r.created_at, finished: r.finished_at, error: r.error_msg })
}

console.log('\nDuplicate admin rows (same code):')
const { data: admins } = await sb.from('apulia_contacts').select('id, ghl_id, sync_status, codice_amministratore, first_name, created_at').eq('is_amministratore', true).order('codice_amministratore')
const byCode = new Map()
for (const a of admins ?? []) {
  const c = a.codice_amministratore
  if (!c) continue
  if (!byCode.has(c)) byCode.set(c, [])
  byCode.get(c).push(a)
}
const dupes = [...byCode.entries()].filter(([_, list]) => list.length > 1)
console.log(`Codes with multiple rows: ${dupes.length}`)
for (const [code, list] of dupes.slice(0, 20)) {
  console.log(`  code=${code}:`)
  for (const r of list) console.log(`    bibot=${r.id} ghl=${r.ghl_id ?? 'null'} sync=${r.sync_status} created=${r.created_at}`)
}
