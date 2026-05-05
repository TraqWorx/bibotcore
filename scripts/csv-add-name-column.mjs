#!/usr/bin/env node
/**
 * Inject a "Full Name" column into a CSV by copying an existing column
 * (default: "Cliente"), so GHL's contact importer satisfies its required-Name
 * mapping automatically without overwriting the source column's mapping.
 *
 * Usage: node scripts/csv-add-name-column.mjs <input.csv> [<output.csv>] [--source=Cliente] [--name="Full Name"]
 */
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const flags = Object.fromEntries(
  process.argv.filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.join('=') || true]
  })
)
const input = args[0]
if (!input) {
  console.error('Usage: csv-add-name-column.mjs <input.csv> [<output.csv>] [--source=Cliente] [--name="Full Name"]')
  process.exit(1)
}
const sourceCol = (flags.source ?? 'Cliente')
const newCol = (flags.name ?? 'Full Name')
const ext = path.extname(input)
const base = input.slice(0, -ext.length)
const output = args[1] ?? `${base}.with-name${ext}`

// Naive RFC4180 parser sufficient for the headers (no embedded commas inside header cells).
function parseLine(line) {
  const cells = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { cur += ch }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { cells.push(cur); cur = '' }
      else { cur += ch }
    }
  }
  cells.push(cur)
  return cells
}
function escapeCell(s) {
  if (s == null) return ''
  const str = String(s)
  return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str
}

const raw = fs.readFileSync(input, 'utf8').replace(/^﻿/, '')
const lines = raw.split(/\r?\n/)
const headers = parseLine(lines[0])
const sourceIdx = headers.findIndex((h) => h.trim() === sourceCol)
if (sourceIdx === -1) {
  console.error(`Source column "${sourceCol}" not found in headers.`)
  console.error('Available headers:', headers.filter(Boolean))
  process.exit(1)
}
if (headers.some((h) => h.trim() === newCol)) {
  console.error(`Column "${newCol}" already exists — refusing to overwrite. Use --name=... to choose a different name.`)
  process.exit(1)
}

const outLines = []
outLines.push([...headers, newCol].map(escapeCell).join(','))
let copied = 0
for (let i = 1; i < lines.length; i++) {
  const line = lines[i]
  if (line === '' && i === lines.length - 1) { outLines.push(''); continue }
  const cells = parseLine(line)
  while (cells.length < headers.length) cells.push('')
  cells.push(cells[sourceIdx] ?? '')
  if (cells[sourceIdx]?.trim()) copied++
  outLines.push(cells.map(escapeCell).join(','))
}

fs.writeFileSync(output, outLines.join('\n'))
console.log(`Wrote ${output}`)
console.log(`  Rows: ${lines.length - 1}`)
console.log(`  ${newCol} populated from ${sourceCol}: ${copied}`)
