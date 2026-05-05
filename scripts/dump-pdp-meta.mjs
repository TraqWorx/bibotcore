import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await sb.from('apulia_imports').select('id, payload_meta').eq('status', 'running').eq('kind', 'pdp').single()
const meta = data.payload_meta
console.log('byPodInit size:', Object.keys(meta?.byPodInit ?? {}).length)
console.log('createdInRun size:', Object.keys(meta?.createdInRun ?? {}).length)
console.log('colFieldMap:')
for (const [k, v] of Object.entries(meta?.colFieldMap ?? {}).slice(0, 8)) console.log(`  "${k}" -> ${v}`)
console.log(`...(${Object.keys(meta?.colFieldMap ?? {}).length} total entries)`)
console.log('\nFirst 3 byPodInit entries:')
for (const [pod, c] of Object.entries(meta?.byPodInit ?? {}).slice(0, 3)) console.log(`  ${pod} -> ${JSON.stringify(c)}`)
