import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Look at failed admin create ops
const { data: failedAdmins } = await sb.from('apulia_sync_queue').select('id, contact_id, last_error, completed_at, last_attempt_at').eq('action', 'create').eq('status', 'failed').gte('created_at', '2026-05-06T13:12:00').limit(50)
console.log(`Failed create ops since 13:12: ${failedAdmins?.length}`)
const errPatterns = new Map()
for (const o of failedAdmins ?? []) {
  const key = (o.last_error ?? '').slice(0, 80)
  errPatterns.set(key, (errPatterns.get(key) ?? 0) + 1)
}
console.log('Failure patterns:')
for (const [pat, n] of [...errPatterns.entries()].sort((a,b) => b[1] - a[1])) console.log(`  ${n}× ${pat}`)

// How many of those failed contacts still exist in DB?
const failedContactIds = (failedAdmins ?? []).map(o => o.contact_id).filter(Boolean)
const { data: existing } = await sb.from('apulia_contacts').select('id, is_amministratore, sync_status').in('id', failedContactIds.slice(0, 200))
const survivingAdmins = (existing ?? []).filter(r => r.is_amministratore)
console.log(`\nFailed-create contacts: ${failedContactIds.length}`)
console.log(`Of those, surviving in DB as admin: ${survivingAdmins.length}`)
console.log(`Of those, deleted: ${failedContactIds.length - (existing?.length ?? 0)}`)
