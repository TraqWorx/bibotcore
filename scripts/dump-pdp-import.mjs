import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await sb.from('apulia_imports').select('id, kind, status, progress_done, progress_total, created, updated, untagged, unmatched, skipped, created_at, finished_at, error_msg').eq('kind','pdp').order('created_at', {ascending: false}).limit(3)
console.log(JSON.stringify(data, null, 2))

// Spot-check a few cache rows
const { data: pods } = await sb.from('apulia_contacts').select('id, pod_pdr, first_name, codice_amministratore').eq('is_amministratore', false).limit(5)
console.log('\nSample condomini in cache:')
for (const p of pods ?? []) console.log(`  ${p.pod_pdr}  ${p.first_name}  cod=${p.codice_amministratore}`)
