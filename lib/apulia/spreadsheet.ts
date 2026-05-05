import * as XLSX from 'xlsx'
import { parseCsv } from './csv'

export interface ParsedSheet {
  headers: string[]
  rows: Record<string, string>[]
}

/**
 * Parse a CSV or XLSX upload into row objects keyed by header.
 * Detects format from the file name (extension) and falls back to
 * sniffing the first byte of the buffer (xlsx files start with 0x50 'PK').
 *
 * For xlsx, the first sheet is read. All cells are coerced to strings so
 * downstream code that expects `string` values keeps working — including
 * long PODs that Excel would otherwise have stored as numbers (we use
 * raw=false so SheetJS uses the cell's display string, preserving leading
 * zeros and avoiding scientific notation).
 */
export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const name = (file.name ?? '').toLowerCase()
  const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xlsm') || name.endsWith('.xlsb')

  if (!isXlsx) {
    // Sniff: zip files start with PK\x03\x04
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    const isZip = head[0] === 0x50 && head[1] === 0x4b
    if (!isZip) {
      const text = await file.text()
      const parsed = parseCsv(text)
      return { headers: parsed.headers, rows: parsed.rows }
    }
  }

  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: false, cellNF: false })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [] }
  const ws = wb.Sheets[sheetName]
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '', blankrows: false })
  if (aoa.length === 0) return { headers: [], rows: [] }

  const rawHeaders = aoa[0].map((h) => (h == null ? '' : String(h).trim()))
  const rows: Record<string, string>[] = []
  for (let i = 1; i < aoa.length; i++) {
    const cells = aoa[i]
    if (!cells || cells.every((c) => c == null || String(c).trim() === '')) continue
    const row: Record<string, string> = {}
    rawHeaders.forEach((h, idx) => {
      if (!h) return
      const v = cells[idx]
      row[h] = v == null ? '' : String(v)
    })
    rows.push(row)
  }
  return { headers: rawHeaders, rows }
}
