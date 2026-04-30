#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const GHL = 'https://services.leadconnectorhq.com'
const APULIA = 'VtNhBfleEQDg0KX4eZqY'
const FIELD = {
  CODICE: '3VwwjdaKH8oQgUO1Vwih',
  COMPENSO: 'kC4I003OOGX4MyGUw8fj',
  TOTAL: 'EEaur1fU5jr56DhfL2eI',
  OVERRIDE: 'IhdF9njhnYTwMGrzOQlg',
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function refreshIfNeeded() {
  const { data: c } = await sb.from('ghl_connections').select('access_token, refresh_token, expires_at').eq('location_id', APULIA).single()
  return c.access_token
}

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
    if (!r.ok) throw new Error('fetch ' + r.status)
    const j = await r.json()
    const batch = j.contacts || []
    out.push(...batch)
    if (batch.length < 500) break
    const last = batch[batch.length - 1]
    searchAfter = last.searchAfter || last.sortBy || null
    if (!searchAfter) break
    if (out.length > 30000) break
  }
  return out
}

const num = (v) => v == null ? 0 : Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0
const cf = (c, id) => {
  const v = c.customFields?.find(f => f.id === id)?.value
  return v == null ? undefined : String(v)
}

async function main() {
  const token = await refreshIfNeeded()
  console.log('Fetching all Apulia contacts…')
  const all = await fetchAll(token)
  console.log('  total:', all.length)
  const admins = all.filter(c => c.tags?.includes('amministratore'))
  const pods = all.filter(c => !c.tags?.includes('amministratore'))
  const activePods = pods.filter(c => !c.tags?.includes('Switch-out'))
  console.log('  admins:', admins.length, '| PODs:', pods.length, '| active:', activePods.length)

  // Group active PODs by code
  const byCode = new Map()
  for (const a of admins) {
    const code = cf(a, FIELD.CODICE)?.trim()
    const compenso = num(cf(a, FIELD.COMPENSO))
    if (code) byCode.set(code, { compenso, total: 0, count: 0 })
  }
  for (const p of activePods) {
    const code = cf(p, FIELD.CODICE)?.trim()
    if (!code) continue
    const e = byCode.get(code)
    if (!e) continue
    const override = num(cf(p, FIELD.OVERRIDE))
    e.total += override > 0 ? override : e.compenso
    e.count += 1
  }

  let updated = 0, unchanged = 0
  let withTotal = 0, zeroTotal = 0
  for (const a of admins) {
    const code = cf(a, FIELD.CODICE)?.trim()
    if (!code) continue
    const e = byCode.get(code)
    if (!e) continue
    const current = num(cf(a, FIELD.TOTAL))
    if (e.total > 0) withTotal++; else zeroTotal++
    if (Math.round(current * 100) === Math.round(e.total * 100)) { unchanged++; continue }
    const r = await fetch(GHL + '/contacts/' + a.id, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, Version: '2021-07-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ customFields: [{ id: FIELD.TOTAL, value: e.total }] }),
    })
    if (r.ok) updated++
    else console.error(' ✗', a.id, r.status, (await r.text()).slice(0,80))
  }
  console.log('Updated:', updated, '| Unchanged:', unchanged)
  console.log('With total:', withTotal, '| Zero total:', zeroTotal)
  console.log('Top 5 by total:')
  ;[...byCode.entries()].sort((a,b)=>b[1].total-a[1].total).slice(0,5).forEach(([code, e]) => {
    const a = admins.find(x => cf(x, FIELD.CODICE) === code)
    console.log('  -', a?.firstName, '| code:', code, '| compenso:', e.compenso, '× PODs:', e.count, '= €', e.total)
  })
}

main().catch(e => { console.error(e); process.exit(1) })
