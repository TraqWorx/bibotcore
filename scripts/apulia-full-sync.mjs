#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const GHL = 'https://services.leadconnectorhq.com'
const APULIA = 'VtNhBfleEQDg0KX4eZqY'
const F = {
  POD_PDR: '3E3OuE0iNMHKe6CWSl3o',
  STATO: 'Hnx2noBu7RGtmXby3DRo',
  CODICE: '3VwwjdaKH8oQgUO1Vwih',
  ADM_NAME: 'z1HlsBxzFtHaCaZ01KnT',
  CLIENTE: 'kgGrpZOgfUZoeTfhs7Ef',
  COMUNE: 'EXO9WD4aLV2aPiMYxXUU',
  COMPENSO: 'kC4I003OOGX4MyGUw8fj',
  TOTAL: 'EEaur1fU5jr56DhfL2eI',
  OVERRIDE: 'IhdF9njhnYTwMGrzOQlg',
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const num = (v) => v == null || v === '' ? null : (Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.')) || null)
const cf = (c, id) => c.customFields?.find(f => f.id === id)?.value
const cfStr = (c, id) => { const v = cf(c, id); return v == null ? null : String(v) }

async function fetchAll(token) {
  const out = []
  let searchAfter = null
  while (true) {
    const body = { locationId: APULIA, pageLimit: 500 }
    if (searchAfter) body.searchAfter = searchAfter
    const r = await fetch(GHL + '/contacts/search', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, Version: '2021-07-28', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error('fetch ' + r.status + ': ' + (await r.text()).slice(0, 200))
    const j = await r.json()
    const batch = j.contacts || []
    out.push(...batch)
    if (batch.length < 500) break
    const last = batch[batch.length - 1]
    searchAfter = last.searchAfter || last.sortBy || null
    if (!searchAfter) break
    if (out.length > 30000) break
    process.stdout.write(`  ${out.length}…\r`)
  }
  return out
}

function toRow(c) {
  const customFields = {}
  for (const f of c.customFields || []) if (f.id && f.value != null) customFields[f.id] = String(f.value)
  return {
    id: c.id,
    email: c.email ?? null,
    phone: c.phone ?? null,
    first_name: c.firstName ?? null,
    last_name: c.lastName ?? null,
    tags: c.tags || [],
    custom_fields: customFields,
    pod_pdr: customFields[F.POD_PDR] ?? null,
    codice_amministratore: customFields[F.CODICE] ?? null,
    amministratore_name: customFields[F.ADM_NAME] ?? null,
    cliente: customFields[F.CLIENTE] ?? c.firstName ?? null,
    comune: customFields[F.COMUNE] ?? null,
    stato: customFields[F.STATO] ?? null,
    compenso_per_pod: num(customFields[F.COMPENSO]),
    pod_override: num(customFields[F.OVERRIDE]),
    commissione_totale: num(customFields[F.TOTAL]),
    is_amministratore: (c.tags || []).includes('amministratore'),
    is_switch_out: (c.tags || []).includes('Switch-out'),
    ghl_updated_at: c.dateUpdated ?? null,
  }
}

async function main() {
  console.log('Refreshing token…')
  const { data: conn } = await sb.from('ghl_connections').select('access_token').eq('location_id', APULIA).single()
  console.log('Fetching all contacts from GHL…')
  const all = await fetchAll(conn.access_token)
  console.log('  total:', all.length)
  console.log('Building rows…')
  const rows = all.map(toRow)

  console.log('Upserting in chunks of 500…')
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await sb.from('apulia_contacts').upsert(chunk, { onConflict: 'id' })
    if (error) { console.error('  chunk', i, ':', error.message); process.exit(1) }
    process.stdout.write(`  ${Math.min(i + 500, rows.length)}/${rows.length}\r`)
  }
  console.log('\nDeleting stale rows…')
  const liveIds = new Set(rows.map(r => r.id))
  const { data: cached } = await sb.from('apulia_contacts').select('id')
  const stale = (cached || []).filter(r => !liveIds.has(r.id)).map(r => r.id)
  if (stale.length) {
    const { error } = await sb.from('apulia_contacts').delete().in('id', stale)
    if (error) console.error('  delete:', error.message)
    else console.log('  deleted', stale.length, 'stale')
  } else {
    console.log('  no stale rows')
  }

  // Verify
  const { count: admins } = await sb.from('apulia_contacts').select('id', {count:'exact', head:true}).eq('is_amministratore', true)
  const { count: pods } = await sb.from('apulia_contacts').select('id', {count:'exact', head:true}).eq('is_amministratore', false)
  console.log('Cache state — admins:', admins, '| PODs:', pods)
}

main().catch(e => { console.error(e); process.exit(1) })
