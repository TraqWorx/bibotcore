import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
// Look at create ops for admins; if completed, the admin row should exist (unless deleted later)
// Check create ops queued today for admins
const start = '2026-05-06T13:12:00'
const { data: createOps } = await sb.from('apulia_sync_queue').select('id, contact_id, status, action, last_error').eq('action', 'create').gte('created_at', start)
console.log(`Create ops today: ${createOps?.length}`)
const byStatus = {}
for (const o of createOps ?? []) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1
console.log('By status:', byStatus)

// Check rows that have IDs from createOps - did the admin survive?
const adminCreateIds = createOps?.filter(o => o.status === 'completed').map(o => o.contact_id).filter(Boolean) ?? []
const { data: existing } = await sb.from('apulia_contacts').select('id, is_amministratore').in('id', adminCreateIds.slice(0, 200))
const surviving = (existing ?? []).filter(r => r.is_amministratore)
console.log(`Sample of 200 completed create ops → admin rows still in DB: ${surviving.length}`)

// Check if any rows got hard-deleted (look for queue ops whose contact_id no longer exists in apulia_contacts)
const { data: completedDels } = await sb.from('apulia_sync_queue').select('id, contact_id, action, completed_at').eq('action', 'delete').eq('status', 'completed').gte('created_at', start).order('completed_at', { ascending: false }).limit(20)
console.log(`\nRecent completed delete ops: ${completedDels?.length}`)
for (const o of completedDels?.slice(0, 5) ?? []) console.log(`  contact ${o.contact_id?.slice(0,8)} completed=${o.completed_at}`)
