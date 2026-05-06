import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
const path = process.argv[2] ?? '/Users/dan/Downloads/PDP ATTIVI NEW_RETE COMMERCIALE-2026-04-21-12-49-36 (1).xlsx'
const buf = readFileSync(path)
const wb = XLSX.read(buf, { type: 'buffer', cellDates: false, cellNF: false })
const ws = wb.Sheets[wb.SheetNames[0]]
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false })
const headers = aoa[0].map((h) => (h == null ? '' : String(h).trim()))
const podIdx = headers.indexOf('POD/PDR')
const emailIdx = headers.indexOf('Fornitura : Dati di fatturazione : Email')
const phoneIdx = headers.indexOf('Fornitura : Cliente : Numero di telefono')
console.log({ podIdx, emailIdx, phoneIdx })

function normalizePod(v) {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  if (/^[+-]?\d+(\.\d+)?[Ee][+-]?\d+$/.test(s)) {
    const n = Number(s)
    if (Number.isFinite(n)) return n.toFixed(0)
  }
  return s
}

const pods = new Map()
const emails = new Map()
let totalRows = 0
let withPod = 0
for (let i = 1; i < aoa.length; i++) {
  const r = aoa[i]
  if (!r || r.every(c => c == null || String(c).trim() === '')) continue
  totalRows++
  const podRaw = r[podIdx]
  const pod = normalizePod((podRaw == null ? '' : String(podRaw)).toUpperCase())
  if (pod) {
    withPod++
    pods.set(pod, (pods.get(pod) ?? 0) + 1)
  }
  const email = r[emailIdx] ? String(r[emailIdx]).trim().toLowerCase() : ''
  if (email) emails.set(email, (emails.get(email) ?? 0) + 1)
}

console.log(`Total non-empty rows: ${totalRows}`)
console.log(`Rows with POD: ${withPod}`)
console.log(`Unique PODs: ${pods.size}`)
const dupePods = [...pods.entries()].filter(([_, n]) => n > 1)
console.log(`PODs appearing more than once: ${dupePods.length}`)
console.log(`Top 5 duplicate PODs: ${JSON.stringify(dupePods.slice(0, 5))}`)

const dupeEmails = [...emails.entries()].filter(([_, n]) => n > 1)
console.log(`\nUnique emails: ${emails.size}`)
console.log(`Emails shared by multiple rows: ${dupeEmails.length}`)
console.log(`Top 5 dupe emails: ${JSON.stringify(dupeEmails.slice(0, 5))}`)
