/**
 * Soft-delete every amministratore in Bibot and enqueue the
 * corresponding GHL deletes. Then trigger a drain so the worker pushes
 * the deletes to GHL and hard-deletes the Bibot rows.
 *
 *   - Rows with ghl_id NULL (never made it to GHL) → hard-delete locally,
 *     no queue op needed.
 *   - Rows with ghl_id set → mark sync_status='pending_delete' and
 *     enqueue a 'delete' op carrying the ghl_id. Worker DELETEs in GHL,
 *     then hard-deletes the Bibot row.
 *
 * Linked POD condomini (codice_amministratore on a non-admin row) are
 * detached locally so they remain in Bibot but unassigned, mirroring the
 * bulkDeleteAdmins server action.
 *
 * Run: node scripts/wipe-all-admins.mjs
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let all = []
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('apulia_contacts').select('id, ghl_id, codice_amministratore').eq('is_amministratore', true).range(from, from + 999)
  if (!data?.length) break
  all = all.concat(data)
  if (data.length < 1000) break
}
console.log(`Found ${all.length} admin rows.`)
if (all.length === 0) { console.log('Nothing to delete.'); process.exit(0) }

const codes = [...new Set(all.map((a) => a.codice_amministratore).filter(Boolean))]
const localOnly = all.filter((a) => !a.ghl_id).map((a) => a.id)
const remote = all.filter((a) => a.ghl_id)

if (localOnly.length) {
  await sb.from('apulia_sync_queue').delete().in('contact_id', localOnly).eq('status', 'pending')
  await sb.from('apulia_contacts').delete().in('id', localOnly)
  console.log(`Hard-deleted ${localOnly.length} local-only rows (no ghl_id).`)
}

if (remote.length) {
  // Soft-delete + enqueue.
  const ids = remote.map((r) => r.id)
  await sb.from('apulia_contacts').update({ sync_status: 'pending_delete' }).in('id', ids)
  // Insert delete ops in chunks
  const ops = remote.map((r) => ({ contact_id: r.id, ghl_id: r.ghl_id, action: 'delete' }))
  const CHUNK = 500
  for (let i = 0; i < ops.length; i += CHUNK) {
    await sb.from('apulia_sync_queue').insert(ops.slice(i, i + CHUNK))
  }
  console.log(`Enqueued ${remote.length} delete ops; rows soft-deleted (sync_status='pending_delete').`)
}

// Detach POD condomini that referenced these admins.
if (codes.length > 0) {
  const { data: orphans } = await sb
    .from('apulia_contacts')
    .select('id, ghl_id')
    .in('codice_amministratore', codes)
    .eq('is_amministratore', false)
    .neq('sync_status', 'pending_delete')
  if (orphans?.length) {
    await sb
      .from('apulia_contacts')
      .update({ codice_amministratore: null, amministratore_name: null, sync_status: 'pending_update' })
      .in('id', orphans.map((r) => r.id))
    const ops = orphans.flatMap((r) => [
      { contact_id: r.id, ghl_id: r.ghl_id ?? null, action: 'set_field', payload: { fieldId: '3VwwjdaKH8oQgUO1Vwih', value: '' } },
      { contact_id: r.id, ghl_id: r.ghl_id ?? null, action: 'set_field', payload: { fieldId: 'z1HlsBxzFtHaCaZ01KnT', value: '' } },
    ])
    const CHUNK = 500
    for (let i = 0; i < ops.length; i += CHUNK) {
      await sb.from('apulia_sync_queue').insert(ops.slice(i, i + CHUNK))
    }
    console.log(`Detached ${orphans.length} POD condomini (codice/name cleared, queued ${ops.length} set_field ops).`)
  }
}

console.log('\nNext step: trigger drain so the worker pushes deletes to GHL.')
console.log('  curl -s -X POST "https://core.bibotcrm.it/api/apulia/sync/drain" -H "x-internal-secret: $CRON_SECRET"')
console.log('Or wait — pg_cron drains every minute.')
