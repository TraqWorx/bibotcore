/**
 * Soft-delete every Apulia contact (admins + condomini) in Bibot, queue
 * the corresponding GHL deletes, and clear any leftover queue ops.
 *
 * Result after running this + draining:
 *   - apulia_contacts: empty
 *   - apulia_sync_queue: empty (or just completed entries)
 *   - GHL Apulia location: empty
 *
 * Run: node scripts/wipe-everything.mjs
 * Then: drain (manually or wait for cron) until queue empties.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// 1. Cancel every pending/failed queue op so we don't fight ourselves.
const { count: cancelledCount } = await sb
  .from('apulia_sync_queue')
  .delete({ count: 'exact' })
  .in('status', ['pending', 'in_progress', 'failed'])
console.log(`Cancelled ${cancelledCount ?? 0} non-completed queue ops.`)

// 2. Pull every Bibot contact (admin + condomino).
let all = []
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('apulia_contacts').select('id, ghl_id').range(from, from + 999)
  if (!data?.length) break
  all = all.concat(data)
  if (data.length < 1000) break
}
console.log(`Found ${all.length} Bibot contact rows total.`)
if (all.length === 0) { console.log('Nothing to wipe.'); process.exit(0) }

const localOnly = all.filter((r) => !r.ghl_id).map((r) => r.id)
const remote = all.filter((r) => r.ghl_id)

if (localOnly.length) {
  // Hard-delete in chunks to keep request size sane.
  const CHUNK = 500
  for (let i = 0; i < localOnly.length; i += CHUNK) {
    await sb.from('apulia_contacts').delete().in('id', localOnly.slice(i, i + CHUNK))
  }
  console.log(`Hard-deleted ${localOnly.length} local-only rows (no ghl_id).`)
}

if (remote.length) {
  // Soft-delete in chunks.
  const CHUNK = 500
  for (let i = 0; i < remote.length; i += CHUNK) {
    await sb.from('apulia_contacts').update({ sync_status: 'pending_delete' }).in('id', remote.slice(i, i + CHUNK).map((r) => r.id))
  }
  // Queue delete ops in chunks.
  const ops = remote.map((r) => ({ contact_id: r.id, ghl_id: r.ghl_id, action: 'delete' }))
  for (let i = 0; i < ops.length; i += CHUNK) {
    await sb.from('apulia_sync_queue').insert(ops.slice(i, i + CHUNK))
  }
  console.log(`Soft-deleted + queued ${remote.length} delete ops for rows with ghl_id.`)
}

console.log('\nNext: drain. Either wait for pg_cron (every minute) or fire it manually:')
console.log('  curl -s -X POST "https://core.bibotcrm.it/api/apulia/sync/drain" -H "x-internal-secret: $CRON_SECRET"')
