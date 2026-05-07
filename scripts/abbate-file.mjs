import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
const buf = readFileSync('/Users/dan/Downloads/AMMINISTRATORI APULIA (1).xlsx')
const wb = XLSX.read(buf, { type: 'buffer', cellDates: false, cellNF: false })
const ws = wb.Sheets[wb.SheetNames[0]]
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false })
const headers = aoa[0].map(h => h == null ? '' : String(h).trim())
const codeIdx = headers.indexOf('Fornitura : Cliente : Codice amministratore')
const compIdx = headers.indexOf('compenso per ciascun pod')
const nameIdx = headers.indexOf('Fornitura : Cliente : Amministratore condominio')
console.log({ codeIdx, compIdx, nameIdx })
for (let i = 1; i < aoa.length; i++) {
  if (String(aoa[i][codeIdx]).trim() === '44777') {
    console.log(`row ${i+1}: name=${JSON.stringify(aoa[i][nameIdx])} code=${JSON.stringify(aoa[i][codeIdx])} compenso=${JSON.stringify(aoa[i][compIdx])}`)
    break
  }
}
