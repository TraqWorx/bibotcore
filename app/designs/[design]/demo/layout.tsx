import SimfoniaSidebar from '@/app/designs/simfonia/_components/Sidebar'
import ApuliaSidebar from '@/app/designs/apulia-tourism/_components/Sidebar'
import '@/app/designs/simfonia/shell.css'
import { DEFAULT_MODULES } from '@/lib/types/design'
import { resolveSimfoniaShell } from '@/lib/simfonia/shellTheme'
import { notFound } from 'next/navigation'
import { demoTheme, apuliaTourismDemoTheme } from './_lib/demoData'

const SUPPORTED_DESIGNS = ['simfonia', 'apulia-tourism'] as const

export default async function DesignDemoLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ design: string }>
}) {
  const { design } = await params

  if (!SUPPORTED_DESIGNS.includes(design as (typeof SUPPORTED_DESIGNS)[number])) {
    notFound()
  }

  const theme = design === 'apulia-tourism' ? apuliaTourismDemoTheme : demoTheme
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

  const SidebarComponent = design === 'apulia-tourism' ? ApuliaSidebar : SimfoniaSidebar

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <div className="simfonia-shell flex min-h-screen">
        <SidebarComponent
          theme={theme}
          modules={DEFAULT_MODULES}
          locationId=""
          demoMode
          showBulkIndicator={false}
          navBasePath={`/designs/${design}/demo`}
        />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <main className="flex-1 px-5 py-7 sm:px-8 sm:py-10">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </>
  )
}
