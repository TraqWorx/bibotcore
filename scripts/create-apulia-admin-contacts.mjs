#!/usr/bin/env node
/**
 * Create one contact on Apulia Power for each XLSX-listed condominium
 * administrator that we already updated to a GHL user. Fills every
 * matching custom field, tags 'amministratore'.
 *
 * Usage:
 *   node scripts/create-apulia-admin-contacts.mjs <xlsx>
 * Reads the user list from the live GHL company users (matched on email).
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'node:module'
const XLSX = createRequire(import.meta.url)('/tmp/package/xlsx.js')

const LOCATION_ID = 'VtNhBfleEQDg0KX4eZqY'
const GHL = 'https://services.leadconnectorhq.com'
const TAG = 'amministratore'
const xlsxPath = process.argv[2]
if (!xlsxPath) { console.error('Usage: <xlsx>'); process.exit(1) }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// XLSX column → GHL custom field id (verified earlier)
const COL_TO_FIELD = {
  'Commodity': 'qcXgHkzIqf1r6EsJPstf',
  'Fornitura : Cliente : Record Type Testuale': '3oogUCrYWsdJScqe0jj4',
  'Fornitura : Cliente : Codice amministratore': '3VwwjdaKH8oQgUO1Vwih',
  'Fornitura : Cliente : Amministratore condominio': 'z1HlsBxzFtHaCaZ01KnT',
  'compenso per ciascun pod': 'kC4I003OOGX4MyGUw8fj',
  'Fornitura : Cliente : Amministratore condominio : Codice fiscale Amministratore': '1OdFYfrSBv45SpzpXjYU',
  'Fornitura : Cliente : Amministratore condominio : Partita IVA': 'umw0sKwGDNNoAjEfgbF7',
  'Fornitura : Dati di fatturazione : Indirizzo': 'oCvfwCelHDn6gWEljqUJ',
  'Fornitura : Dati di fatturazione : Indirizzo (Città)': 'EXO9WD4aLV2aPiMYxXUU',
  'Fornitura : Dati di fatturazione : Indirizzo (Stato/Provincia)': 'opaPQWrWwDiaAeyoMbN5',
  'Fornitura : Cliente : Numero Telefono Amministratore': 'Z64lLhsexIXdoeVm0rOQ',
  'Fornitura : Dati di fatturazione : Email': 'VhxwXDyczBN04vmRUTDf',
}

function sanitizePhone(raw) {
  if (raw == null) return null
  const digits = String(raw).replace(/[^\d+]/g, '')
  if (!digits || /^0+$/.test(digits)) return null
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('00')) return '+' + digits.slice(2)
  if (digits.startsWith('39')) return '+' + digits
  // Italian local — prefix country code
  return '+39' + digits
}

;(async () => {
  // 1. Two tokens: location OAuth for /contacts, agency PIT for /users/search
  const { data: conn } = await sb.from('ghl_connections').select('access_token').eq('location_id', LOCATION_ID).single()
  const locToken = conn.access_token
  const agencyToken = process.env.GHL_AGENCY_TOKEN
  if (!agencyToken) throw new Error('GHL_AGENCY_TOKEN not set')
  const Hloc = { Authorization: 'Bearer ' + locToken, Version: '2021-07-28', 'Content-Type': 'application/json' }
  const Hagency = { Authorization: 'Bearer ' + agencyToken, Version: '2021-07-28' }

  // 2. XLSX rows, indexed by email (first row wins for each admin)
  const wb = XLSX.readFile(xlsxPath)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
  const byEmail = new Map()
  for (const r of rows) {
    const email = String(r['Fornitura : Dati di fatturazione : Email'] || '').toLowerCase().trim()
    if (!email) continue
    if (!byEmail.has(email)) byEmail.set(email, r)
  }

  // 3. Live GHL user list — only act on those that are now user+Apulia
  let users = []; let skip = 0
  while (true) {
    const r = await fetch(`${GHL}/users/search?companyId=${process.env.GHL_COMPANY_ID}&limit=100&skip=${skip}`, { headers: Hagency })
    const j = await r.json()
    const batch = j.users || []
    users = users.concat(batch)
    if (batch.length < 100) break
    skip += 100
    if (skip > 5000) break
  }
  console.log(`Total company users: ${users.length}`)
  const apuliaAdminEmails = users
    .filter((u) => u.roles?.role === 'user' && u.roles?.locationIds?.includes(LOCATION_ID) && u.email)
    .map((u) => u.email.toLowerCase().trim())
  console.log(`Apulia users (role=user, has Apulia): ${apuliaAdminEmails.length}`)
  console.log(`XLSX distinct emails: ${byEmail.size}`)
  // Take only those that also exist in the XLSX (so we have data to fill)
  const targets = apuliaAdminEmails.filter((e) => byEmail.has(e))
  console.log(`Apulia users with XLSX data to import: ${targets.length}`)

  let ok = 0, skipped = 0, fail = 0
  const failures = []
  for (let i = 0; i < targets.length; i++) {
    const email = targets[i]
    const row = byEmail.get(email)

    // Build customFields array
    const customFields = []
    for (const [col, fieldId] of Object.entries(COL_TO_FIELD)) {
      const v = row[col]
      if (v === '' || v == null) continue
      customFields.push({ id: fieldId, value: String(v) })
    }

    // Name from the dedicated column (when present); fall back to the email handle
    const adminName = String(row['Fornitura : Cliente : Amministratore condominio'] || '').trim()
    const firstName = adminName || email.split('@')[0]

    const phone = sanitizePhone(row['Fornitura : Cliente : Numero Telefono Amministratore'])

    const body = {
      locationId: LOCATION_ID,
      email,
      firstName,
      tags: [TAG],
      customFields,
      ...(phone ? { phone } : {}),
    }

    const r = await fetch(`${GHL}/contacts/`, { method: 'POST', headers: Hloc, body: JSON.stringify(body) })
    if (r.ok) {
      ok++
    } else {
      const text = await r.text()
      // Skip the duplicate case as harmless
      if (r.status === 400 && /duplicat/i.test(text)) {
        skipped++
      } else {
        fail++
        failures.push({ email, status: r.status, body: text.slice(0, 250) })
      }
    }
    if ((i + 1) % 25 === 0) console.log(`  progress ${i + 1}/${targets.length} | ok ${ok} | skipped ${skipped} | fail ${fail}`)
  }
  console.log(`\nDone — created ${ok}, already-existed ${skipped}, failed ${fail}`)
  if (failures.length) {
    fs.writeFileSync('/tmp/contact_creation_failures.json', JSON.stringify(failures, null, 2))
    console.log('Sample failures:')
    failures.slice(0, 5).forEach((f) => console.log(' -', f.email, '|', f.status, f.body))
  }
})().catch((e) => { console.error(e); process.exit(1) })
