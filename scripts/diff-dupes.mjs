import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Look at all admins still in DB with codice 14407432 or 14459571
const { data } = await sb
  .from('apulia_contacts')
  .select('id, ghl_id, sync_status, codice_amministratore, first_name, custom_fields')
  .eq('is_amministratore', true)
  .in('codice_amministratore', ['14407432', '14459571'])
console.log(`Rows with these codes: ${data?.length}`)
for (const r of data ?? []) {
  console.log({
    id: r.id, ghl_id: r.ghl_id, sync_status: r.sync_status,
    column_code: JSON.stringify(r.codice_amministratore),
    cf_code: JSON.stringify(r.custom_fields?.['3VwwjdaKH8oQgUO1Vwih']),
    code_chars: r.codice_amministratore?.split('').map((c) => c.charCodeAt(0)).join(','),
  })
}
