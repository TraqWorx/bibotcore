#!/usr/bin/env node
/**
 * Rename GHL custom fields on Apulia Power so they exactly match the
 * column headers of the CSV import file. Pass --apply to write changes;
 * default is dry-run.
 *
 * Usage:
 *   node scripts/rename-apulia-fields.mjs <csv> [--apply]
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const GHL = 'https://services.leadconnectorhq.com'
const LOCATION_ID = 'VtNhBfleEQDg0KX4eZqY'
const csvPath = process.argv[2]
const apply = process.argv.includes('--apply')
if (!csvPath) {
  console.error('Usage: rename-apulia-fields.mjs <csv> [--apply]')
  process.exit(1)
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function readCsvHeaders(path) {
  const raw = fs.readFileSync(path, 'utf8').replace(/^﻿/, '')
  const firstLine = raw.split(/\r?\n/)[0]
  // CSV headers in this file are simple comma-separated, no embedded commas in any header.
  return firstLine.split(',').map((h) => h.trim()).filter(Boolean)
}

// Strip a leading parenthesised prefix once, allowing nested parens.
// "(English (note)) Italian Name" → "Italian Name"
function stripPrefix(s) {
  const t = s.trimStart()
  if (t[0] !== '(') return s.trim()
  let depth = 0
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '(') depth++
    else if (t[i] === ')') {
      depth--
      if (depth === 0) return t.slice(i + 1).trim()
    }
  }
  return s.trim()
}

function norm(s) {
  return stripPrefix(s)
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*/g, ' : ')
    .trim()
    .toLowerCase()
}

;(async () => {
  const { data: conn } = await sb.from('ghl_connections').select('access_token').eq('location_id', LOCATION_ID).single()
  const headers = { Authorization: 'Bearer ' + conn.access_token, Version: '2021-07-28' }

  const r = await fetch(GHL + `/locations/${LOCATION_ID}/customFields`, { headers })
  const fields = (await r.json()).customFields ?? []

  const csvCols = readCsvHeaders(csvPath)
  console.log(`CSV columns: ${csvCols.length}`)
  console.log(`GHL fields:  ${fields.length}`)

  // Build lookup of GHL fields by normalized name (using stripped italian suffix).
  const fieldByNorm = new Map()
  for (const f of fields) fieldByNorm.set(norm(f.name), f)

  // Resolve each CSV column to a GHL field.
  const plan = [] // { csv, field, action: 'rename' | 'noop' | 'missing' }
  const usedFieldIds = new Set()
  for (const csv of csvCols) {
    let f = fieldByNorm.get(norm(csv))
    // Suffix fallback: handles GHL fields with malformed parens whose strip
    // failed but whose name still ends with the Italian suffix.
    if (!f) {
      const target = norm(csv)
      f = fields.find((g) => !usedFieldIds.has(g.id) && norm(g.name).endsWith(target))
    }
    if (!f) {
      plan.push({ csv, field: null, action: 'missing' })
      continue
    }
    usedFieldIds.add(f.id)
    if (f.name === csv) plan.push({ csv, field: f, action: 'noop' })
    else plan.push({ csv, field: f, action: 'rename' })
  }

  const renames = plan.filter((p) => p.action === 'rename')
  const noops = plan.filter((p) => p.action === 'noop')
  const missing = plan.filter((p) => p.action === 'missing')

  console.log(`\nALREADY ALIGNED: ${noops.length}`)
  for (const p of noops) console.log('  =', p.csv)

  console.log(`\nWILL RENAME: ${renames.length}`)
  for (const p of renames) {
    console.log('  •', p.field.name)
    console.log('    →', p.csv)
  }

  console.log(`\nNO MATCH IN GHL (would need creating): ${missing.length}`)
  for (const p of missing) console.log('  ?', p.csv)

  // Identify GHL fields that don't appear in the CSV — leave them alone, just report.
  // Exclude fields already matched into the plan (which can happen via suffix
  // fallback even when the strict norm-set check would miss them).
  const matchedIds = new Set(plan.filter((p) => p.field).map((p) => p.field.id))
  const orphanFields = fields.filter((f) => !matchedIds.has(f.id))
  console.log(`\nGHL FIELDS NOT IN CSV (leaving unchanged): ${orphanFields.length}`)
  for (const f of orphanFields) console.log('  -', f.name)

  if (!apply) {
    console.log('\n--- DRY RUN. Re-run with --apply to make changes. ---')
    return
  }

  console.log('\n--- APPLYING RENAMES ---')
  let ok = 0, fail = 0
  for (const p of renames) {
    const r = await fetch(GHL + `/locations/${LOCATION_ID}/customFields/${p.field.id}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: p.csv, dataType: p.field.dataType, position: p.field.position ?? 0 }),
    })
    if (r.ok) { ok++; console.log('  ✓', p.csv) }
    else { fail++; console.log('  ✗', p.csv, '->', r.status, (await r.text()).slice(0, 200)) }
  }
  console.log(`\nRenamed ${ok}, failed ${fail}.`)
})().catch((e) => { console.error(e); process.exit(1) })
