import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await sb.from('apulia_imports').update({
  status: 'failed',
  finished_at: new Date().toISOString(),
  error_msg: 'aborted: GHL rate limit',
}).eq('status', 'running').eq('kind', 'pdp').select('id')
console.log(`Aborted ${data?.length ?? 0} running PDP runs.`)
