const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * Returns `value` only if it is a safe `#rgb` / `#rrggbb` hex color, otherwise
 * `fallback`. Theme colors are stored as free-form strings (set via the editor /
 * AI chat) and later interpolated into a `<style>` block, so they must be
 * validated to prevent CSS/markup injection on the public embed.
 */
export function safeHexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim()) ? value.trim() : fallback
}
