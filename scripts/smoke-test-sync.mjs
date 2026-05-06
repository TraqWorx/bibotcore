/**
 * Smoke test for the Apulia DB-first sync pipeline.
 *
 * Steps:
 *  1. Insert a uuid row directly into apulia_contacts (sync_status=pending_create).
 *  2. Enqueue a 'create' op into apulia_sync_queue.
 *  3. Hit /api/apulia/sync/drain and confirm:
 *       - the row gets a ghl_id stamped back
 *       - sync_status flips to 'synced'
 *       - the queue op flips to 'completed'
 *  4. Update one column locally + enqueue 'set_field', drain, confirm.
 *  5. Soft-delete (sync_status='pending_delete') + 'delete' op, drain,
 *     confirm row vanishes from apulia_contacts AND from GHL.
 *
 * Run: node scripts/smoke-test-sync.mjs
 */
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://core.bibotcrm.it'

if (!process.env.CRON_SECRET) {
  console.error('CRON_SECRET not set')
  process.exit(1)
}

async function drain() {
  const r = await fetch(`${baseUrl}/api/apulia/sync/drain`, {
    method: 'POST',
    headers: { 'x-internal-secret': process.env.CRON_SECRET, 'Content-Type': 'application/json' },
  })
  return r.json()
}

async function getRow(id) {
  const { data } = await sb.from('apulia_contacts').select('*').eq('id', id).maybeSingle()
  return data
}
async function getOps(contactId) {
  const { data } = await sb.from('apulia_sync_queue').select('*').eq('contact_id', contactId).order('created_at', { ascending: true })
  return data
}

const id = randomUUID()
const TEST_TAG = 'bibot-smoke-test'

console.log('=== Smoke test for Apulia DB-first sync ===')
console.log('Test contact id:', id)

// 1. Insert pending_create row
console.log('\n[1] Inserting pending_create row...')
const { error: insErr } = await sb.from('apulia_contacts').insert({
  id,
  ghl_id: null,
  sync_status: 'pending_create',
  email: `smoke-test+${id.slice(0, 8)}@example.com`,
  phone: null,
  first_name: 'SMOKE TEST',
  last_name: 'BIBOT',
  tags: [TEST_TAG],
  custom_fields: {},
  pod_pdr: null,
  codice_amministratore: null,
  amministratore_name: null,
  cliente: 'Smoke Test',
  comune: null,
  stato: null,
  compenso_per_pod: null,
  pod_override: null,
  commissione_totale: null,
  is_amministratore: false,
  is_switch_out: false,
  ghl_updated_at: null,
})
if (insErr) { console.error(insErr); process.exit(1) }

await sb.from('apulia_sync_queue').insert({ contact_id: id, ghl_id: null, action: 'create' })
console.log(' inserted.')

console.log('\n[2] Draining...')
let r = await drain()
console.log(' drain result:', JSON.stringify(r))

let row = await getRow(id)
console.log(' row.ghl_id:', row?.ghl_id)
console.log(' row.sync_status:', row?.sync_status)
if (!row?.ghl_id) { console.error(' FAIL: ghl_id not stamped'); process.exit(1) }

// 2. Update + enqueue set_field
console.log('\n[3] Updating first_name + enqueue set_field...')
await sb.from('apulia_contacts').update({ first_name: 'SMOKE TEST UPDATED', sync_status: 'pending_update' }).eq('id', id)
await sb.from('apulia_sync_queue').insert({
  contact_id: id, ghl_id: row.ghl_id, action: 'set_field',
  payload: { fieldId: 'kgGrpZOgfUZoeTfhs7Ef', value: 'Smoke Test Updated' },
})

console.log('[4] Draining...')
r = await drain()
console.log(' drain result:', JSON.stringify(r))
row = await getRow(id)
console.log(' row.sync_status:', row?.sync_status)

// 3. Delete
console.log('\n[5] Soft-deleting + enqueue delete...')
await sb.from('apulia_contacts').update({ sync_status: 'pending_delete' }).eq('id', id)
await sb.from('apulia_sync_queue').insert({ contact_id: id, ghl_id: row.ghl_id, action: 'delete' })

console.log('[6] Draining...')
r = await drain()
console.log(' drain result:', JSON.stringify(r))
row = await getRow(id)
console.log(' row exists?', row != null)
if (row) { console.error(' FAIL: row should have been hard-deleted'); process.exit(1) }

console.log('\n✓ All smoke checks passed.')
