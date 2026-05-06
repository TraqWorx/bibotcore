import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await sb.from('apulia_sync_queue').select('id, action, attempts, last_error, contact_id').eq('status', 'failed').order('last_attempt_at', { ascending: false }).limit(5)
for (const r of data ?? []) console.log({ id: r.id.slice(0,8), action: r.action, attempts: r.attempts, contact: r.contact_id?.slice(0,8), err: (r.last_error ?? '').slice(0, 250) })
