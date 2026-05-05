import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data } = await sb.from('apulia_imports').select('id, kind, filename, status, progress_done, progress_total, last_progress_at').eq('status', 'running')
console.log(`${data?.length ?? 0} running rows:`)
for (const r of data ?? []) {
  const ageMs = r.last_progress_at ? Date.now() - new Date(r.last_progress_at).getTime() : Infinity
  console.log(`  ${r.kind} ${r.filename} ${r.progress_done}/${r.progress_total} age=${Math.round(ageMs/1000)}s`)
  if (ageMs > 90_000) {
    await sb.from('apulia_imports').update({ status: 'failed', finished_at: new Date().toISOString(), error_msg: 'timed out (legacy run, no resume support)' }).eq('id', r.id)
    console.log(`    → marked failed`)
  }
}
