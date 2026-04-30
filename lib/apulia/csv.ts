/**
 * Tiny RFC-4180-ish CSV parser. Sufficient for the Apulia inputs which use
 * comma-separated values with optional double-quoted cells; embedded commas
 * inside quoted cells are handled.
 */
export interface CsvParsed {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCsv(raw: string): CsvParsed {
  const text = raw.replace(/^﻿/, '')
  const lines: string[] = []
  let buf = ''
  let inQuotes = false
  for (const ch of text) {
    if (ch === '"') { inQuotes = !inQuotes; buf += ch; continue }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (buf.length > 0) lines.push(buf)
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf.length > 0) lines.push(buf)
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = parseRow(lines[0])
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseRow(lines[i])
    if (cells.every((c) => !c.trim())) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { if (h) row[h] = cells[idx] ?? '' })
    rows.push(row)
  }
  return { headers: headers.map((h) => h.trim()), rows }
}

function parseRow(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') inQ = false
      else cur += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') { cells.push(cur); cur = '' }
      else cur += c
    }
  }
  cells.push(cur)
  return cells
}
