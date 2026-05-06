import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Find rows in pending_create with a corresponding 'failed' queue op.
const { data: failedOps } = await sb.from('apulia_sync_queue').select('contact_id, last_error').eq('status', 'failed')
for (const op of failedOps ?? []) {
  if (!op.contact_id) continue
  const { data: row } = await sb.from('apulia_contacts').select('id, sync_status').eq('id', op.contact_id).maybeSingle()
  if (!row) continue
  if (row.sync_status === 'pending_create' || row.sync_status === 'pending_update') {
    await sb.from('apulia_contacts').update({ sync_status: 'failed', sync_error: op.last_error }).eq('id', row.id)
    console.log(`Marked ${row.id} (sync_status=${row.sync_status} → failed)`)
  }
}
