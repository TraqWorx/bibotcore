import { darkenHex, mixHex } from '@/lib/utils/colorUtils'
import type { DesignTheme } from '@/lib/types/design'

export const DEMO_STYLE_IDS = ['serena', 'atelier', 'obsidian', 'frost', 'frame'] as const

export type DemoStyleId = (typeof DEMO_STYLE_IDS)[number]

export const DEFAULT_DEMO_STYLE: DemoStyleId = 'serena'

export interface DemoStyleMeta {
  id: DemoStyleId
  name: string
  short: string
  description: string
}

export const DEMO_STYLES: DemoStyleMeta[] = [
  {
    id: 'serena',
    name: 'Pastel Colors',
    short: 'Soft luxury',
    description: 'Warm premium CRM with pastel shells, soft contrast, and a calm executive feel.',
  },
  {
    id: 'atelier',
    name: 'Editorial Light',
    short: 'Magazine clean',
    description: 'Bright editorial CRM with lighter canvases, cleaner white surfaces, and more open typography.',
  },
  {
    id: 'obsidian',
    name: 'Dark Control',
    short: 'Dark command',
    description: 'Dark graphite workspace with glowing accents, stronger contrast, and control-room energy.',
  },
  {
    id: 'frost',
    name: 'Glass Air',
    short: 'Glassy frost',
    description: 'Cool translucent CRM with frosted surfaces, airy highlights, and a softer modern-tech mood.',
  },
  {
    id: 'frame',
    name: 'Enterprise Sharp',
    short: 'Structured pro',
    description: 'Structured cream-and-ink layout with crisp borders, denser hierarchy, and enterprise polish.',
  },
]

export function isDemoStyleId(value: string | null | undefined): value is DemoStyleId {
  return !!value && DEMO_STYLE_IDS.includes(value as DemoStyleId)
}

export function getDemoStyleMeta(style: DemoStyleId): DemoStyleMeta {
  return DEMO_STYLES.find((item) => item.id === style) ?? DEMO_STYLES[0]
}

export function resolveDemoShell(theme: DesignTheme, style: DemoStyleId) {
  const primary = theme.primaryColor
  const accent = theme.secondaryColor

  switch (style) {
    case 'atelier':
      return {
        foreground: '#1b1916',
        shellSidebar: darkenHex(primary, 0.06),
        shellBg: mixHex(accent, '#fcf8f1', 0.95),
        shellSurface: mixHex(accent, '#ffffff', 0.985),
        shellCanvas: mixHex(accent, '#fffaf2', 0.91),
        shellMuted: mixHex(primary, '#9d9386', 0.8),
        shellLine: mixHex(primary, '#e7dac8', 0.84),
        shellSoft: mixHex(accent, '#fffaf2', 0.87),
        shellSoftAlt: mixHex(accent, '#fff6ec', 0.93),
        shellTint: mixHex(accent, '#ffffff', 0.78),
        shellTintStrong: mixHex(accent, '#ffffff', 0.62),
      }
    case 'obsidian':
      return {
        foreground: '#f6f1e8',
        shellSidebar: darkenHex(primary, 0.18),
        shellBg: mixHex(primary, '#0f1112', 0.78),
        shellSurface: mixHex(primary, '#171a1d', 0.68),
        shellCanvas: mixHex(primary, '#1f2327', 0.64),
        shellMuted: mixHex(accent, '#a9b4bb', 0.72),
        shellLine: mixHex(primary, '#394048', 0.72),
        shellSoft: mixHex(accent, '#202629', 0.7),
        shellSoftAlt: mixHex(accent, '#171d20', 0.58),
        shellTint: mixHex(accent, '#2b3034', 0.4),
        shellTintStrong: mixHex(accent, '#272c31', 0.22),
      }
    case 'frost':
      return {
        foreground: '#1c1b1a',
        shellSidebar: mixHex(primary, '#213041', 0.36),
        shellBg: mixHex(accent, '#f4f8fb', 0.9),
        shellSurface: mixHex(accent, '#ffffff', 0.94),
        shellCanvas: mixHex(accent, '#f5fbff', 0.82),
        shellMuted: mixHex(primary, '#7f8b95', 0.76),
        shellLine: mixHex(primary, '#d5dee6', 0.82),
        shellSoft: mixHex(accent, '#f4fbff', 0.83),
        shellSoftAlt: mixHex(accent, '#eef7fb', 0.88),
        shellTint: mixHex(accent, '#ffffff', 0.72),
        shellTintStrong: mixHex(accent, '#ffffff', 0.56),
      }
    case 'frame':
      return {
        foreground: '#161412',
        shellSidebar: darkenHex(primary, 0.02),
        shellBg: mixHex(primary, '#f6f0e6', 0.9),
        shellSurface: mixHex(accent, '#fffdf9', 0.975),
        shellCanvas: mixHex(accent, '#f9f4ea', 0.9),
        shellMuted: mixHex(primary, '#80786e', 0.78),
        shellLine: mixHex(primary, '#d9cdbd', 0.74),
        shellSoft: mixHex(accent, '#faf5ea', 0.82),
        shellSoftAlt: mixHex(accent, '#f6efe4', 0.88),
        shellTint: mixHex(accent, '#ffffff', 0.68),
        shellTintStrong: mixHex(accent, '#ffffff', 0.5),
      }
    case 'serena':
    default:
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
}

export function demoStyleCookie(style: string | null | undefined): DemoStyleId {
  return isDemoStyleId(style) ? style : DEFAULT_DEMO_STYLE
}
