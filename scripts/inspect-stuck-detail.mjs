import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Re-pull both pairs from the DB explicitly
const stuckIds = [
  'd06c89b9-d6c4-4b61-9fd1-6644120828d7', // CANZANO
  'b9c2a13e-cef0-447f-bbb8-5e5e4be1d93b', // DE BELLIS pending
  '366eac5c-63f7-4691-9ec6-40021f1db852', // DI FRATTA
]
const partnerIds = [
  'dd99a811-3dce-48a5-9c03-a1774891f606', // DI FRATTA synced (ghl=lTsC3LjLnz5HSb4JSznx)
  'cb472a26-8e83-412d-8dfa-b79ad2f57c26', // DE BELLIS synced (ghl=21or64RuBC7yE32ZkjBy)
]

const { data } = await sb.from('apulia_contacts').select('*').in('id', [...stuckIds, ...partnerIds])
for (const r of data ?? []) {
  console.log({
    id: r.id,
    ghl_id: r.ghl_id,
    sync_status: r.sync_status,
    is_amministratore: r.is_amministratore,
    first_name: r.first_name,
    codice_amministratore: r.codice_amministratore,
    email: r.email,
    cf_codice: r.custom_fields?.['3VwwjdaKH8oQgUO1Vwih'],
    cf_email: r.custom_fields?.['VhxwXDyczBN04vmRUTDf'],
    created_at: r.created_at,
  })
}
