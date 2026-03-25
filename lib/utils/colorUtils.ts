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
