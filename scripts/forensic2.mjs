import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: imp } = await sb.from('apulia_imports').select('id, created_at, finished_at').eq('kind', 'pdp').order('created_at', { ascending: false }).limit(1).maybeSingle()
console.log('PDP import:', imp)

// Pull SAMPLE create ops with full info
const { data: ops } = await sb.from('apulia_sync_queue').select('id, contact_id, action, status, created_at, completed_at').eq('import_id', imp.id).eq('action', 'create').limit(5)
console.log('\n5 create ops sample:')
for (const o of ops ?? []) {
  console.log(`  op ${o.id.slice(0,8)} contact ${o.contact_id?.slice(0,8)} status=${o.status} created=${o.created_at} completed=${o.completed_at}`)
  // Look up that contact
  const { data: row } = await sb.from('apulia_contacts').select('id, ghl_id, pod_pdr, sync_status').eq('id', o.contact_id).maybeSingle()
  if (row) console.log(`    → row exists: ghl_id=${row.ghl_id} pod=${row.pod_pdr} sync=${row.sync_status}`)
  else console.log(`    → row MISSING`)
  // Find row with same POD if any
  if (!row && o.contact_id) {
    // Try to find by ghl_id from queue op
    const { data: byGhl } = await sb.from('apulia_sync_queue').select('ghl_id').eq('id', o.id).maybeSingle()
    if (byGhl?.ghl_id) {
      const { data: ghlRow } = await sb.from('apulia_contacts').select('id, pod_pdr').eq('ghl_id', byGhl.ghl_id).maybeSingle()
      if (ghlRow) console.log(`    → other row holds same ghl_id ${byGhl.ghl_id}: id=${ghlRow.id.slice(0,8)} pod=${ghlRow.pod_pdr}`)
    }
  }
}
