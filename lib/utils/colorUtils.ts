/** Darken a 6-digit hex color by `amount` (0–1). */
export function darkenHex(hex: string, amount: number): string {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) return hex
  const n = parseInt(cleaned, 16)
  const r = Math.max(0, (n >> 16) - Math.round(255 * amount))
  const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(255 * amount))
  const b = Math.max(0, (n & 0xff) - Math.round(255 * amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** Lighten a 6-digit hex color by `amount` (0–1). */
export function lightenHex(hex: string, amount: number): string {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) return hex
  const n = parseInt(cleaned, 16)
  const r = Math.min(255, (n >> 16) + Math.round(255 * amount))
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * amount))
  const b = Math.min(255, (n & 0xff) + Math.round(255 * amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function splitHex(hex: string): [number, number, number] | null {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) return null
  const n = parseInt(cleaned, 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function joinHex(r: number, g: number, b: number): string {
  return `#${((clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b)).toString(16).padStart(6, '0')}`
}

/** Blend 2 hex colors. `amount` is how much of `target` to mix in. */
export function mixHex(hex: string, target: string, amount: number): string {
  const a = splitHex(hex)
  const b = splitHex(target)
  if (!a || !b) return hex
  const [r1, g1, b1] = a
  const [r2, g2, b2] = b
  return joinHex(
    r1 + (r2 - r1) * amount,
    g1 + (g2 - g1) * amount,
    b1 + (b2 - b1) * amount,
  )
}

export function hexToRgbTuple(hex: string): [number, number, number] | null {
  return splitHex(hex)
}
