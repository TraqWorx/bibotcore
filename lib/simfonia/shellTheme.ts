import { darkenHex, mixHex } from '@/lib/utils/colorUtils'
import type { DesignTheme } from '@/lib/types/design'

export function resolveSimfoniaShell(theme: DesignTheme) {
  const primary = theme.primaryColor
  const accent = theme.secondaryColor

  return {
    foreground: '#171512',
    shellSidebar: darkenHex(primary, 0.12),
    shellBg: mixHex(accent, '#faf6ee', 0.92),
    shellSurface: mixHex(accent, '#fffdfa', 0.965),
    shellCanvas: mixHex(accent, '#fdf8ef', 0.88),
    shellMuted: mixHex(primary, '#8f8578', 0.72),
    shellLine: mixHex(primary, '#efe4d2', 0.78),
    shellSoft: mixHex(accent, '#fffdf8', 0.82),
    shellSoftAlt: mixHex(accent, '#fff7ec', 0.9),
    shellTint: mixHex(accent, '#ffffff', 0.72),
    shellTintStrong: mixHex(accent, '#ffffff', 0.56),
  }
}
