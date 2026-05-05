import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { count: before } = await sb.from('apulia_contacts').select('*', { count: 'exact', head: true })
console.log(`Before: ${before} cache rows`)

const { error } = await sb.from('apulia_contacts').delete().neq('id', '__sentinel__')
if (error) { console.error('Delete failed:', error); process.exit(1) }

const { count: after } = await sb.from('apulia_contacts').select('*', { count: 'exact', head: true })
console.log(`After: ${after} cache rows`)
