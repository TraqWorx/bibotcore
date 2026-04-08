import { darkenHex, mixHex } from '@/lib/utils/colorUtils'
import type { DesignTheme } from '@/lib/types/design'

export function resolveSimfoniaShell(theme: DesignTheme) {
  const primary = theme.primaryColor
  const accent = theme.secondaryColor

  return {
    foreground: '#1a1a2e',
    shellSidebar: darkenHex(primary, 0.12),
    shellBg: mixHex(primary, '#f8f8fc', 0.92),
    shellSurface: mixHex(primary, '#ffffff', 0.965),
    shellCanvas: mixHex(primary, '#f5f5fa', 0.88),
    shellMuted: mixHex(primary, '#8888a0', 0.72),
    shellLine: mixHex(primary, '#e8e8f0', 0.78),
    shellSoft: mixHex(accent, '#f8f8ff', 0.82),
    shellSoftAlt: mixHex(accent, '#f4f4fc', 0.9),
    shellTint: mixHex(accent, '#ffffff', 0.72),
    shellTintStrong: mixHex(accent, '#ffffff', 0.56),
  }
}
