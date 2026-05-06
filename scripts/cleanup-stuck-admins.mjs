/**
 * Clean up admin rows that are stuck in sync_status='pending_create' with
 * no ghl_id. Two cases handled:
 *
 *   A. Duplicate by code: another row with the SAME codice_amministratore
 *      already has ghl_id stamped. The stuck row is a true duplicate of
 *      the synced row → hard-delete + cancel queue ops.
 *
 *   B. Email collision in GHL: stuck row's email is held by a different
 *      Bibot row (different code) that already has ghl_id. GHL deduped
 *      by email, so we can't link this Bibot row to its own GHL contact.
 *      Mark the queue op as failed with a clear explanation and leave
 *      the row in place so the user can fix the data.
 *
 * Run: node scripts/cleanup-stuck-admins.mjs
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// All admin rows
const { data: admins } = await sb
  .from('apulia_contacts')
  .select('id, ghl_id, sync_status, codice_amministratore, first_name, email')
  .eq('is_amministratore', true)

const stuck = (admins ?? []).filter((a) => a.sync_status === 'pending_create' && !a.ghl_id)
console.log(`Stuck admin rows: ${stuck.length}`)
if (stuck.length === 0) { console.log('Nothing to clean.'); process.exit(0) }

const byCode = new Map()
const byEmail = new Map()
for (const a of admins ?? []) {
  if (a.codice_amministratore) {
    if (!byCode.has(a.codice_amministratore)) byCode.set(a.codice_amministratore, [])
    byCode.get(a.codice_amministratore).push(a)
  }
  if (a.email) {
    if (!byEmail.has(a.email)) byEmail.set(a.email, [])
    byEmail.get(a.email).push(a)
  }
}

let deleted = 0
let markedFailed = 0
for (const s of stuck) {
  // Case A: duplicate code
  const codeMates = (byCode.get(s.codice_amministratore) ?? []).filter((x) => x.id !== s.id && x.ghl_id)
  if (codeMates.length > 0) {
    console.log(`DELETE ${s.id} (${s.first_name}, code ${s.codice_amministratore}) — duplicate of ${codeMates[0].id}`)
    await sb.from('apulia_sync_queue').delete().eq('contact_id', s.id)
    await sb.from('apulia_contacts').delete().eq('id', s.id)
    deleted++
    continue
  }
  // Case B: email held by a different code's row
  if (s.email) {
    const emailMates = (byEmail.get(s.email) ?? []).filter((x) => x.id !== s.id && x.ghl_id)
    if (emailMates.length > 0) {
      const msg = `Email collision: GHL contact ${emailMates[0].ghl_id} already linked to admin ${emailMates[0].first_name} (code ${emailMates[0].codice_amministratore}). Two admins in your file share this email; resolve duplicates and re-import this one.`
      console.log(`MARK FAILED ${s.id} (${s.first_name}, code ${s.codice_amministratore}) — ${msg}`)
      await sb.from('apulia_sync_queue').update({ status: 'failed', last_error: msg }).eq('contact_id', s.id).in('status', ['pending', 'completed'])
      await sb.from('apulia_contacts').update({ sync_status: 'failed', sync_error: msg }).eq('id', s.id)
      markedFailed++
      continue
    }
  }
  console.log(`SKIP ${s.id} (${s.first_name}, code ${s.codice_amministratore}) — no obvious cause; investigate manually`)
}

console.log(`\nDone. deleted=${deleted}, markedFailed=${markedFailed}`)
