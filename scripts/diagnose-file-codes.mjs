/**
 * Read the admins xlsx file with the same parser the import uses, then
 * find every row whose codice_amministratore appears more than once and
 * dump byte-level details so we can see if "duplicate" rows actually
 * differ in some invisible way.
 */
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const path = process.argv[2] ?? '/Users/dan/Downloads/AMMINISTRATORI APULIA (1).xlsx'
const buf = readFileSync(path)
const wb = XLSX.read(buf, { type: 'buffer', cellDates: false, cellNF: false })
const ws = wb.Sheets[wb.SheetNames[0]]
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false })
const rawHeaders = aoa[0].map((h) => (h == null ? '' : String(h).trim()))
const COL_Code = 'Fornitura : Cliente : Codice amministratore'
const COL_Name = 'Fornitura : Cliente : Amministratore condominio'
const codeIdx = rawHeaders.indexOf(COL_Code)
const nameIdx = rawHeaders.indexOf(COL_Name)
console.log(`Header indices: code=${codeIdx} name=${nameIdx}`)
console.log(`Total data rows: ${aoa.length - 1}`)

// Rows with both name and code populated, after trim — these go into byCode logic
const candidateRows = []
for (let i = 1; i < aoa.length; i++) {
  const r = aoa[i]
  const rawCode = r[codeIdx]
  const rawName = r[nameIdx]
  const code = rawCode == null ? '' : String(rawCode).trim()
  const name = rawName == null ? '' : String(rawName).trim()
  if (!code || !name) continue
  candidateRows.push({ rowIdx: i + 1, rawCode, rawName, code, name })
}
console.log(`Rows with name+code: ${candidateRows.length}`)

const byCode = new Map()
for (const r of candidateRows) {
  if (!byCode.has(r.code)) byCode.set(r.code, [])
  byCode.get(r.code).push(r)
}
const dupes = [...byCode.entries()].filter(([_, list]) => list.length > 1)
console.log(`Codes with >1 row: ${dupes.length}`)
console.log(`Unique codes: ${byCode.size}`)

for (const [code, list] of dupes) {
  console.log(`\n=== code=${JSON.stringify(code)} (${list.length} rows) ===`)
  for (const r of list) {
    const codeStr = String(r.rawCode ?? '')
    const codeBytes = [...codeStr].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join(' ')
    const nameStr = String(r.rawName ?? '')
    console.log(`  row ${r.rowIdx}: name=${JSON.stringify(nameStr)}`)
    console.log(`    rawCode (typeof ${typeof r.rawCode}): ${JSON.stringify(codeStr)}`)
    console.log(`    rawCode hex: ${codeBytes}`)
    console.log(`    trimmed code: ${JSON.stringify(r.code)}`)
  }
}
