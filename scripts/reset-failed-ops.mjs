/**
 * Reset all failed queue ops back to pending so the worker retries them.
 * Also clear sync_error on the corresponding apulia_contacts rows and
 * flip sync_status back to pending_create / pending_update so the UI
 * stops showing them as failed while they retry.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: failed } = await sb
  .from('apulia_sync_queue')
  .update({ status: 'pending', attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null })
  .eq('status', 'failed')
  .select('id, contact_id, action')
console.log(`Reset ${failed?.length ?? 0} failed ops to pending.`)

// Flip the matching contact rows back to pending_create / pending_update
const contactIds = [...new Set((failed ?? []).map(f => f.contact_id).filter(Boolean))]
if (contactIds.length) {
  const createOps = (failed ?? []).filter(f => f.action === 'create').map(f => f.contact_id)
  const otherOps = (failed ?? []).filter(f => f.action !== 'create').map(f => f.contact_id)
  if (createOps.length) {
    await sb.from('apulia_contacts').update({ sync_status: 'pending_create', sync_error: null }).in('id', createOps)
    console.log(`Flipped ${createOps.length} contact rows to pending_create.`)
  }
  if (otherOps.length) {
    await sb.from('apulia_contacts').update({ sync_status: 'pending_update', sync_error: null }).in('id', otherOps)
    console.log(`Flipped ${otherOps.length} contact rows to pending_update.`)
  }
}
