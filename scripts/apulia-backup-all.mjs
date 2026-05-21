import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

mkdirSync('backups', { recursive: true })
const ts = new Date().toISOString().replace(/[:.]/g, '-')

async function dump(table) {
  let all = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('*').range(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    all = all.concat(data)
    if (data.length < 1000) break
  }
  const path = `backups/${table}_pre-demo-wipe_${ts}.json`
  writeFileSync(path, JSON.stringify(all, null, 2))
  console.log(`  ${table.padEnd(28)} ${String(all.length).padStart(6)} rows → ${path}`)
  return all.length
}

console.log('Backing up Apulia tables before demo wipe…')
for (const t of ['apulia_contacts', 'apulia_payments', 'apulia_imports', 'apulia_opportunities', 'apulia_sync_queue']) {
  await dump(t)
}
console.log('\nBackup complete.')
