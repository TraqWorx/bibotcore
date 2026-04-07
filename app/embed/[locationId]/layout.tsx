import { resolveSimfoniaShell } from '@/lib/simfonia/shellTheme'
import { DEFAULT_THEME } from '@/lib/types/design'
import '@/app/designs/simfonia/shell.css'

export const metadata = {
  title: 'Dashboard',
}

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  const shell = resolveSimfoniaShell(DEFAULT_THEME)
  const cssVars = `:root {
    --brand: ${DEFAULT_THEME.secondaryColor};
    --accent: ${DEFAULT_THEME.secondaryColor};
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
