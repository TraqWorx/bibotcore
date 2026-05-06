/**
 * Look for emails shared by multiple rows in the file. GHL deduplicates
 * by email — two file rows with different codes but the same email
 * collapse into one GHL contact, which is what we've been calling a
 * "case B" collision.
 */
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const path = process.argv[2] ?? '/Users/dan/Downloads/AMMINISTRATORI APULIA (1).xlsx'
const buf = readFileSync(path)
const wb = XLSX.read(buf, { type: 'buffer', cellDates: false, cellNF: false })
const ws = wb.Sheets[wb.SheetNames[0]]
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false })
const headers = aoa[0].map((h) => (h == null ? '' : String(h).trim()))
const idx = (h) => headers.indexOf(h)
const COL = {
  code: idx('Fornitura : Cliente : Codice amministratore'),
  name: idx('Fornitura : Cliente : Amministratore condominio'),
  email: idx('Fornitura : Dati di fatturazione : Email'),
  phone: idx('Fornitura : Cliente : Numero Telefono Amministratore'),
}
console.log('Column indices:', COL)

const rows = []
for (let i = 1; i < aoa.length; i++) {
  const r = aoa[i]
  const code = (r[COL.code] == null ? '' : String(r[COL.code]).trim())
  const name = (r[COL.name] == null ? '' : String(r[COL.name]).trim())
  const email = (r[COL.email] == null ? '' : String(r[COL.email]).trim().toLowerCase())
  const phone = (r[COL.phone] == null ? '' : String(r[COL.phone]).trim())
  if (!code || !name) continue
  rows.push({ rowIdx: i + 1, code, name, email, phone })
}
console.log(`Admin rows: ${rows.length}`)

const byEmail = new Map()
for (const r of rows) {
  if (!r.email) continue
  if (!byEmail.has(r.email)) byEmail.set(r.email, [])
  byEmail.get(r.email).push(r)
}
const sharedEmails = [...byEmail.entries()].filter(([_, list]) => list.length > 1)
console.log(`\nEmails shared across multiple admin rows: ${sharedEmails.length}`)
for (const [email, list] of sharedEmails) {
  console.log(`  ${email}: ${list.length} rows`)
  for (const r of list) console.log(`    row ${r.rowIdx}  code=${r.code}  name=${r.name}`)
}

// Same for phone
const byPhone = new Map()
for (const r of rows) {
  if (!r.phone) continue
  if (!byPhone.has(r.phone)) byPhone.set(r.phone, [])
  byPhone.get(r.phone).push(r)
}
const sharedPhones = [...byPhone.entries()].filter(([_, list]) => list.length > 1)
console.log(`\nPhones shared across multiple admin rows: ${sharedPhones.length}`)
for (const [phone, list] of sharedPhones) {
  console.log(`  ${phone}: ${list.length} rows`)
  for (const r of list) console.log(`    row ${r.rowIdx}  code=${r.code}  name=${r.name}`)
}

console.log(`\nUnique emails:  ${byEmail.size}`)
console.log(`Rows with empty email: ${rows.filter((r) => !r.email).length}`)
