import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Find legacy admin imports stored as kind='pdp' with filename starting [ADMINS]
const { data: rows } = await sb.from('apulia_imports').select('id, kind, filename, created_at').or('filename.ilike.%[ADMINS]%,filename.ilike.%amministratori%').order('created_at', { ascending: false })
console.log('Candidates:')
for (const r of rows ?? []) console.log(`  ${r.created_at}  kind=${r.kind}  ${r.filename}`)

const ids = (rows ?? []).filter((r) => r.kind === 'pdp' && /\[ADMINS\]|amministratori/i.test(r.filename ?? '')).map((r) => r.id)
console.log(`\nWill flip ${ids.length} row(s) to kind='admins' and clean filename.`)
for (const r of (rows ?? []).filter((r) => ids.includes(r.id))) {
  const cleanName = (r.filename ?? '').replace(/^\[ADMINS\]\s*/, '')
  await sb.from('apulia_imports').update({ kind: 'admins', filename: cleanName }).eq('id', r.id)
}
console.log('Done.')
