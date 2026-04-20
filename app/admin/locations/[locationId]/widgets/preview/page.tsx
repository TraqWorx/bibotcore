'use client'

import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { resolveSimfoniaShell } from '@/lib/simfonia/shellTheme'
import { DEFAULT_THEME } from '@/lib/types/design'
import type { WidgetConfig, DashboardColors } from '@/lib/widgets/types'
import WidgetGrid from '@/lib/widgets/WidgetGrid'

export default function DashboardPreviewPage() {
  const searchParams = useSearchParams()
  const raw = searchParams.get('data')

  const { widgets, colors, locationId } = useMemo(() => {
    try {
      const parsed = JSON.parse(decodeURIComponent(raw ?? '{}'))
      return {
        widgets: (parsed.widgets ?? []) as WidgetConfig[],
        colors: (parsed.colors ?? {}) as DashboardColors,
        locationId: (parsed.locationId ?? '') as string,
      }
    } catch {
      return { widgets: [], colors: {} as DashboardColors, locationId: '' }
    }
  }, [raw])

  const theme = useMemo(() => ({
    ...DEFAULT_THEME,
    primaryColor: colors.primaryColor ?? DEFAULT_THEME.primaryColor,
    secondaryColor: colors.secondaryColor ?? DEFAULT_THEME.secondaryColor,
  }), [colors])

  const shell = useMemo(() => resolveSimfoniaShell(theme), [theme])

  const cssVars = `
    --brand: ${theme.secondaryColor};
    --accent: ${theme.secondaryColor};
    --foreground: ${shell.foreground};
    --shell-bg: ${shell.shellBg};
    --shell-surface: ${shell.shellSurface};
    --shell-canvas: ${shell.shellCanvas};
    --shell-muted: ${shell.shellMuted};
    --shell-line: ${shell.shellLine};
    --shell-soft: ${shell.shellSoft};
    --shell-soft-alt: ${shell.shellSoftAlt};
    --shell-tint: ${shell.shellTint};
    --shell-tint-strong: ${shell.shellTintStrong};
    --shell-sidebar: ${shell.shellSidebar};
  `

  if (!widgets.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">No widgets to preview.</p>
      </div>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `:root { ${cssVars} }` }} />
      <div className="min-h-screen p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--shell-bg)' }}>
        <div className="mx-auto max-w-7xl">
          <WidgetGrid layout={{ columns: 12, widgets }} locationId={locationId} />
        </div>
      </div>
    </>
  )
}
