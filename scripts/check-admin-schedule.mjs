import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: admins } = await sb.from('apulia_contacts').select('id, first_name, first_payment_at').eq('is_amministratore', true)
console.log(`Total admins: ${admins.length}`)
const withFP = admins.filter(a => a.first_payment_at).length
const withoutFP = admins.filter(a => !a.first_payment_at).length
console.log(`  with first_payment_at:    ${withFP}`)
console.log(`  without first_payment_at: ${withoutFP}`)

// Distribution of first_payment_at by date
const byDate = new Map()
for (const a of admins) {
  const d = a.first_payment_at ? a.first_payment_at.slice(0, 10) : 'NULL'
  byDate.set(d, (byDate.get(d) ?? 0) + 1)
}
console.log('\nfirst_payment_at distribution:')
for (const [d, n] of [...byDate].sort()) console.log(`  ${d}: ${n}`)

const { data: sched } = await sb.rpc('apulia_admin_schedule')
const dueNow = sched.filter(s => s.is_due_now).length
const overdue = sched.filter(s => (s.overdue_count ?? 0) > 0).length
console.log(`\nFrom RPC: is_due_now=${dueNow}, overdue_count>0=${overdue}`)
