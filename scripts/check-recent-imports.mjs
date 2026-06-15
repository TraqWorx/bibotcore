import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await sb.from('apulia_imports').select('id, kind, status, progress_done, progress_total, created, updated, unmatched, error_msg, created_at').order('created_at', {ascending: false}).limit(5)
for (const r of data ?? []) console.log(`${r.created_at}  ${r.status}  ${r.kind}  ${r.progress_done}/${r.progress_total}  +${r.created} ↻${r.updated} ⚠${r.unmatched}  err=${r.error_msg ?? '—'}`)
