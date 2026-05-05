import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Load .env.local manually (no dotenv dep needed).
const envText = readFileSync('.env.local', 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing Supabase env vars'); process.exit(1) }
const sb = createClient(url, key)

const { data: rows, error: readErr } = await sb.from('apulia_payments').select('*')
if (readErr) { console.error('Read failed:', readErr); process.exit(1) }
console.log(`Found ${rows.length} payment rows.`)

mkdirSync('backups', { recursive: true })
const ts = new Date().toISOString().replace(/[:.]/g, '-')
const path = `backups/apulia_payments_${ts}.json`
writeFileSync(path, JSON.stringify(rows, null, 2))
console.log(`Backup → ${path}`)

if (rows.length === 0) { console.log('Nothing to delete.'); process.exit(0) }

const { error: delErr, count } = await sb
  .from('apulia_payments')
  .delete()
  .neq('id', '00000000-0000-0000-0000-000000000000')
  .select('*', { count: 'exact', head: true })
if (delErr) { console.error('Delete failed:', delErr); process.exit(1) }
console.log(`Deleted ${count ?? 'all'} rows from apulia_payments.`)

const { count: remaining } = await sb.from('apulia_payments').select('*', { count: 'exact', head: true })
console.log(`Remaining: ${remaining}`)
