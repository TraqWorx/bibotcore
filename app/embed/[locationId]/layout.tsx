import { resolveSimfoniaShell } from '@/lib/simfonia/shellTheme'
import { DEFAULT_THEME, type DesignTheme } from '@/lib/types/design'
import { createAdminClient } from '@/lib/supabase-server'
import '@/app/designs/simfonia/shell.css'

export const metadata = {
  title: 'Dashboard',
}

export default async function EmbedLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params

  // Load custom colors from dashboard_configs
  const sb = createAdminClient()
  const { data: config } = await sb
    .from('dashboard_configs')
    .select('theme')
    .eq('location_id', locationId)
    .maybeSingle()

  const customTheme = config?.theme as { primaryColor?: string; secondaryColor?: string } | null
  const theme: DesignTheme = {
    ...DEFAULT_THEME,
    ...(customTheme?.primaryColor && { primaryColor: customTheme.primaryColor }),
    ...(customTheme?.secondaryColor && { secondaryColor: customTheme.secondaryColor }),
  }

  const shell = resolveSimfoniaShell(theme)
  const cssVars = `:root {
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
  }`

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <div className="min-h-screen bg-[var(--shell-bg)] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          {children}
        </div>
      </div>
    </>
  )
}
