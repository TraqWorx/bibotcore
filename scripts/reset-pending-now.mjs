/**
 * Reset all pending ops to be due immediately + zero attempts. Useful
 * when worker logic was just upgraded and we want it re-evaluating
 * stuck ops without waiting for backoff.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await sb.from('apulia_sync_queue').update({
  next_attempt_at: new Date().toISOString(),
  attempts: 0,
}).eq('status', 'pending').select('id')
console.log(`Reset ${data?.length ?? 0} pending ops to due now.`)
