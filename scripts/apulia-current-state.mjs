import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const [contacts, admins, switchOut, payments, imports, ops, queuePending] = await Promise.all([
  sb.from('apulia_contacts').select('*', { count: 'exact', head: true }),
  sb.from('apulia_contacts').select('*', { count: 'exact', head: true }).eq('is_amministratore', true),
  sb.from('apulia_contacts').select('*', { count: 'exact', head: true }).eq('is_switch_out', true),
  sb.from('apulia_payments').select('*', { count: 'exact', head: true }),
  sb.from('apulia_imports').select('*', { count: 'exact', head: true }),
  sb.from('apulia_opportunities').select('*', { count: 'exact', head: true }),
  sb.from('apulia_sync_queue').select('*', { count: 'exact', head: true }).in('status', ['pending','in_progress','failed']),
])

console.log('Apulia current state:')
console.log(`  apulia_contacts total:          ${contacts.count}`)
console.log(`    - amministratori:             ${admins.count}`)
console.log(`    - switch-out:                 ${switchOut.count}`)
console.log(`    - condomini (rest):           ${(contacts.count ?? 0) - (admins.count ?? 0)}`)
console.log(`  apulia_payments:                ${payments.count}`)
console.log(`  apulia_imports (history):       ${imports.count}`)
console.log(`  apulia_opportunities:           ${ops.count}`)
console.log(`  apulia_sync_queue (open ops):   ${queuePending.count}`)
