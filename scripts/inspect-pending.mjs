import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const now = new Date().toISOString()
const [{ count: dueNow }, { count: future }, { count: total }] = await Promise.all([
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending').lte('next_attempt_at', now),
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending').gt('next_attempt_at', now),
  sb.from('apulia_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
])
console.log({ now, dueNow, future, totalPending: total })

console.log('\n5 pending samples (sorted by next_attempt_at):')
const { data: samples } = await sb
  .from('apulia_sync_queue')
  .select('id, action, attempts, next_attempt_at, last_error')
  .eq('status', 'pending')
  .order('next_attempt_at', { ascending: true })
  .limit(5)
for (const s of samples ?? []) {
  console.log(`  ${s.id} action=${s.action} attempts=${s.attempts} next=${s.next_attempt_at} err=${(s.last_error ?? '').slice(0, 200)}`)
}

console.log('\n5 pending samples (sorted by next_attempt_at DESC):')
const { data: latest } = await sb
  .from('apulia_sync_queue')
  .select('id, action, attempts, next_attempt_at, last_error')
  .eq('status', 'pending')
  .order('next_attempt_at', { ascending: false })
  .limit(5)
for (const s of latest ?? []) {
  console.log(`  ${s.id} action=${s.action} attempts=${s.attempts} next=${s.next_attempt_at} err=${(s.last_error ?? '').slice(0, 200)}`)
}
