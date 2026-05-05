#!/usr/bin/env node
/**
 * One-shot enumeration of every accessible resource for a given GHL location.
 * Reads the OAuth-installed access_token from Supabase, refreshes if needed,
 * then probes each endpoint family in parallel and prints a structured summary.
 *
 * Usage: node scripts/discover-location.mjs <locationId>
 * Requires the same env as the Next.js app (.env.local).
 */
import { createClient } from '@supabase/supabase-js'

const GHL = 'https://services.leadconnectorhq.com'
const locationId = process.argv[2]
if (!locationId) {
  console.error('Usage: discover-location.mjs <locationId>')
  process.exit(1)
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function refreshIfNeeded(conn) {
  const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : 0
  if (expiresAt - Date.now() > 5 * 60 * 1000) return conn.access_token
  const r = await fetch(GHL + '/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GHL_CLIENT_ID,
      client_secret: process.env.GHL_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
    }),
  })
  if (!r.ok) throw new Error('refresh failed: ' + (await r.text()))
  const j = await r.json()
  await sb.from('ghl_connections').update({
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString(),
    refreshed_at: new Date().toISOString(),
  }).eq('location_id', locationId)
  return j.access_token
}

async function get(token, path, version = '2021-07-28') {
  const r = await fetch(GHL + path, { headers: { Authorization: 'Bearer ' + token, Version: version } })
  if (!r.ok) return { error: r.status, body: (await r.text()).slice(0, 200) }
  return r.json()
}

async function postSearch(token, path, body) {
  const r = await fetch(GHL + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, Version: '2021-07-28', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) return { error: r.status, body: (await r.text()).slice(0, 200) }
  return r.json()
}

;(async () => {
  const { data: conn } = await sb.from('ghl_connections').select('*').eq('location_id', locationId).single()
  if (!conn) {
    console.error('No ghl_connections row for', locationId, '— OAuth-install required first.')
    process.exit(1)
  }
  const token = await refreshIfNeeded(conn)

  const [location, users, customFields, customValues, tags, pipelines, calendars, workflows, forms, surveys, contactsHead] = await Promise.all([
    get(token, `/locations/${locationId}`),
    get(token, `/users/search?companyId=${conn.company_id}&locationId=${locationId}&limit=100`),
    get(token, `/locations/${locationId}/customFields`),
    get(token, `/locations/${locationId}/customValues`),
    get(token, `/locations/${locationId}/tags`),
    get(token, `/opportunities/pipelines?locationId=${locationId}`),
    get(token, `/calendars/?locationId=${locationId}`),
    get(token, `/workflows/?locationId=${locationId}`),
    get(token, `/forms/?locationId=${locationId}`),
    get(token, `/surveys/?locationId=${locationId}`),
    postSearch(token, '/contacts/search', { locationId, pageLimit: 1 }),
  ])

  function count(obj, ...keys) {
    if (!obj || obj.error) return obj?.error ? `ERR ${obj.error}` : '—'
    for (const k of keys) if (Array.isArray(obj?.[k])) return obj[k].length
    return Object.keys(obj).length
  }

  const summary = {
    location: location?.location?.name ?? location?.name ?? location?.error,
    users: count(users, 'users'),
    contactsTotal: contactsHead?.total ?? contactsHead?.error ?? '—',
    customFields: count(customFields, 'customFields'),
    customValues: count(customValues, 'customValues'),
    tags: count(tags, 'tags'),
    pipelines: count(pipelines, 'pipelines'),
    calendars: count(calendars, 'calendars'),
    workflows: count(workflows, 'workflows'),
    forms: count(forms, 'forms'),
    surveys: count(surveys, 'surveys'),
  }
  console.log('\n=== SUMMARY ===')
  console.log(JSON.stringify(summary, null, 2))

  console.log('\n=== USERS ===')
  for (const u of users?.users ?? []) console.log(' -', u.firstName, u.lastName, '|', u.email, '|', u.roles?.role ?? u.role)

  console.log('\n=== TAGS ===')
  for (const t of tags?.tags ?? []) console.log(' -', t.name)

  console.log('\n=== CUSTOM FIELDS ===')
  for (const f of customFields?.customFields ?? []) console.log(' -', f.name, '(' + f.dataType + ')')

  console.log('\n=== PIPELINES ===')
  for (const p of pipelines?.pipelines ?? []) {
    console.log(' -', p.name, '(' + (p.stages?.length ?? 0) + ' stages)')
    for (const s of p.stages ?? []) console.log('     ·', s.name)
  }

  console.log('\n=== CALENDARS ===')
  for (const c of calendars?.calendars ?? []) console.log(' -', c.name, '|', c.calendarType)

  console.log('\n=== WORKFLOWS ===')
  for (const w of workflows?.workflows ?? []) console.log(' -', w.name, '| status:', w.status)

  console.log('\n=== FORMS ===')
  for (const f of forms?.forms ?? []) console.log(' -', f.name)

  console.log('\n=== SURVEYS ===')
  for (const s of surveys?.surveys ?? []) console.log(' -', s.name)
})().catch((e) => { console.error(e); process.exit(1) })
