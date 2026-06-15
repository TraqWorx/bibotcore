import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await sb.from('apulia_imports').select('id, status, progress_done, progress_total, last_progress_at, last_continue_at, created_at').eq('status', 'running').single()
const now = Date.now()
console.log('id:', data.id)
console.log('progress:', data.progress_done, '/', data.progress_total)
console.log('created_at:', data.created_at, `(${Math.round((now - new Date(data.created_at).getTime())/1000)}s ago)`)
console.log('last_progress_at:', data.last_progress_at, data.last_progress_at ? `(${Math.round((now - new Date(data.last_progress_at).getTime())/1000)}s ago)` : '')
console.log('last_continue_at:', data.last_continue_at, data.last_continue_at ? `(in ${Math.round((new Date(data.last_continue_at).getTime() - now)/1000)}s, ${new Date(data.last_continue_at).getTime() > now ? 'future' : 'past'})` : '')
