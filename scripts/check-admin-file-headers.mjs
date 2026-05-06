import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
const path = process.argv[2] ?? '/Users/dan/Downloads/AMMINISTRATORI APULIA (1).xlsx'
const buf = readFileSync(path)
const wb = XLSX.read(buf, { type: 'buffer', cellDates: false, cellNF: false })
const ws = wb.Sheets[wb.SheetNames[0]]
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false })
const headers = aoa[0].map((h) => (h == null ? '' : String(h).trim()))
console.log(`Headers in ${path}:\n`)
headers.forEach((h, i) => console.log(`  [${i}] ${JSON.stringify(h)}`))

// Look for any header that mentions compenso
const compensoHeaders = headers.filter((h) => h.toLowerCase().includes('compen'))
console.log(`\nHeaders matching "compen": ${compensoHeaders.length}`)
compensoHeaders.forEach((h) => console.log(`  ${JSON.stringify(h)}`))

// Sample a few rows for those columns
if (compensoHeaders.length) {
  console.log(`\nFirst 5 rows for compenso columns:`)
  for (let i = 1; i <= 5 && i < aoa.length; i++) {
    const r = aoa[i]
    for (const h of compensoHeaders) {
      const idx = headers.indexOf(h)
      console.log(`  row ${i+1} ${JSON.stringify(h)} = ${JSON.stringify(r[idx])}`)
    }
  }
}
