import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data } = await sb.from('apulia_imports').select('id, kind, filename, status, progress_done, progress_total, last_progress_at, created_at, error_msg').order('created_at', { ascending: false }).limit(8)
for (const r of data ?? []) {
  const ageMs = r.last_progress_at ? Date.now() - new Date(r.last_progress_at).getTime() : null
  console.log(`${r.created_at}  ${r.status}  ${r.kind}  ${r.progress_done}/${r.progress_total}  age=${ageMs ? Math.round(ageMs/1000)+'s' : '—'}  ${r.error_msg ?? ''}  ${r.filename}`)
}

// Also: are there condomini in cache?
const { data: rows } = await sb.from('apulia_contacts').select('id, pod_pdr, first_name, cliente, cached_at').eq('is_amministratore', false).limit(5)
console.log('\nFirst 5 cache rows:')
for (const r of rows ?? []) console.log(`  ${r.cached_at}  ${r.pod_pdr}  ${r.first_name ?? r.cliente}`)
