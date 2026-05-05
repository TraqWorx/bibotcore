import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Only clear admins with first_payment_at set today AND no payments and no POD yet.
// (If they had POD or payments we'd preserve the anchor.)
const today = new Date().toISOString().slice(0, 10)
const { data: candidates } = await sb
  .from('apulia_contacts')
  .select('id, first_payment_at, codice_amministratore')
  .eq('is_amministratore', true)
  .gte('first_payment_at', today + 'T00:00:00Z')

console.log(`Admins with first_payment_at set today: ${candidates?.length ?? 0}`)

let cleared = 0
for (const a of candidates ?? []) {
  // Skip if any POD already linked to this admin
  if (a.codice_amministratore) {
    const { count: podCount } = await sb
      .from('apulia_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('codice_amministratore', a.codice_amministratore)
      .eq('is_amministratore', false)
    if (podCount && podCount > 0) {
      console.log(`  keeping ${a.id} (has ${podCount} POD)`)
      continue
    }
  }
  // Skip if has payments
  const { count: payCount } = await sb
    .from('apulia_payments')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', a.id)
  if (payCount && payCount > 0) {
    console.log(`  keeping ${a.id} (has ${payCount} payments)`)
    continue
  }
  await sb.from('apulia_contacts').update({ first_payment_at: null }).eq('id', a.id)
  cleared++
}
console.log(`Cleared first_payment_at on ${cleared} admins.`)
