import Sidebar from '@/app/designs/simfonia/_components/Sidebar'
import '@/app/designs/simfonia/shell.css'
import { DEFAULT_MODULES } from '@/lib/types/design'
import { resolveDemoShell, type DemoStyleId } from '@/lib/simfonia/demoStyles'
import { notFound } from 'next/navigation'
import { demoTheme } from './_lib/demoData'

export default async function DesignDemoLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ design: string }>
}) {
  const { design } = await params

  if (design !== 'simfonia') {
    notFound()
  }

  const demoStyle: DemoStyleId = 'serena'
  const shell = resolveDemoShell(demoTheme, demoStyle)
  const cssVars = `:root {
    --brand: ${demoTheme.secondaryColor};
    --accent: ${demoTheme.secondaryColor};
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
      <div className="simfonia-shell flex min-h-screen" data-demo-style={demoStyle}>
        <Sidebar
          theme={demoTheme}
          modules={DEFAULT_MODULES}
          locationId=""
          styleVariant={demoStyle}
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
