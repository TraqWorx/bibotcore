import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const [{ count: total }, { count: synced }, { count: pendingCreate }] = await Promise.all([
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('sync_status', 'synced'),
  sb.from('apulia_contacts').select('id', { count: 'exact', head: true }).eq('is_amministratore', false).eq('sync_status', 'pending_create'),
])
console.log('Condomini (non-admin) rows:', { total, synced, pendingCreate })
const { data: imports } = await sb.from('apulia_imports').select('id, kind, status, filename, rows_total, progress_done, error_msg, created_at').eq('kind', 'pdp').order('created_at', { ascending: false }).limit(3)
console.log('\nRecent PDP imports:')
for (const r of imports ?? []) console.log({ id: r.id.slice(0,8), status: r.status, file: r.filename, rows: r.rows_total, done: r.progress_done, err: (r.error_msg ?? '').slice(0, 200), at: r.created_at })
