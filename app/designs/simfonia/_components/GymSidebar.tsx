'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { darkenHex, lightenHex } from '@/lib/utils/colorUtils'
import type { DesignTheme, DesignModules } from '@/lib/types/design'
import BulkJobsIndicator from './BulkJobsIndicator'

function NavGlyph({ name }: { name: string }) {
  const c = 'h-[18px] w-[18px] shrink-0'
  switch (name) {
    case 'dashboard':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.65} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      )
    case 'contacts':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.65} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
      )
    case 'conversations':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.65} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
        </svg>
      )
    case 'pipeline':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.65} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
        </svg>
      )
    case 'calendar':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.65} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5a2.25 2.25 0 0 0 2.25-2.25m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5a2.25 2.25 0 0 1 2.25 2.25v7.5" />
        </svg>
      )
    case 'automations':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.65} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
        </svg>
      )
    case 'settings':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.65} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a7.49 7.49 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a7.52 7.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a7.156 7.156 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      )
    default:
      return <span className={`${c} rounded-full bg-current opacity-40`} />
  }
}

const MODULE_NAV = [
  { key: 'dashboard', label: 'Dashboard', path: '/designs/simfonia/dashboard' },
  { key: 'contacts', label: 'Contatti', path: '/designs/simfonia/contacts' },
  { key: 'conversations', label: 'Conversazioni', path: '/designs/simfonia/conversations' },
  { key: 'pipeline', label: 'Pipeline', path: '/designs/simfonia/pipeline' },
  { key: 'calendar', label: 'Calendario', path: '/designs/simfonia/calendar' },
  { key: 'automations', label: 'Automazioni', path: '/designs/simfonia/automations' },
  { key: 'settings', label: 'Impostazioni', path: '/designs/simfonia/settings' },
] as const

function hexToRgb(hex: string): string {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) return '255,255,255'
  const n = parseInt(cleaned, 16)
  return `${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff}`
}

function NavLink({
  href,
  label,
  navKey,
  secondaryColor,
  isActive,
  isPending,
  onClick,
}: {
  href: string
  label: string
  navKey: string
  secondaryColor: string
  isActive: boolean
  isPending: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  const active = isActive || isPending
  const rgb2 = hexToRgb(secondaryColor)

  return (
    <a
      href={href}
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        active
          ? 'text-white shadow-lg shadow-black/20 ring-1 ring-white/10'
          : 'text-white/60 hover:bg-white/[0.07] hover:text-white/95'
      }`}
      style={
        active
          ? {
              background: `linear-gradient(135deg, rgba(${rgb2},0.22) 0%, rgba(${rgb2},0.08) 100%)`,
              border: `1px solid rgba(${rgb2},0.35)`,
            }
          : { border: '1px solid transparent' }
      }
    >
      <span
        className={active ? '' : 'opacity-80 group-hover:opacity-100'}
        style={{ color: active ? secondaryColor : undefined }}
      >
        <NavGlyph name={navKey} />
      </span>
      {label}
    </a>
  )
}

interface GymSidebarProps {
  theme: DesignTheme
  modules: DesignModules
  locationId: string
}

export default function GymSidebar({ theme, modules, locationId }: GymSidebarProps) {
  const darkBg = darkenHex(theme.primaryColor, 0.22)
  const midTint = lightenHex(theme.primaryColor, 0.06)
  const qs = locationId ? `?locationId=${locationId}` : ''
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingPath, setPendingPath] = useState<string | null>(null)

  const navItems = MODULE_NAV.filter((item) => {
    const mod = modules[item.key as keyof DesignModules]
    return mod === undefined || mod.enabled !== false
  })

  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-r border-white/[0.07] shadow-[8px_0_40px_-12px_rgba(0,0,0,0.35)]"
      style={{
        background: `linear-gradient(165deg, ${theme.primaryColor} 0%, ${midTint} 42%, ${darkBg} 100%)`,
      }}
    >
      <div className="flex items-center gap-3 px-4 py-5">
        <div
          className="rounded-2xl border border-white/10 bg-white/[0.09] p-0.5 shadow-inner backdrop-blur-sm"
          style={{ boxShadow: `inset 0 1px 0 0 rgba(${hexToRgb(theme.secondaryColor)}, 0.15)` }}
        >
          {theme.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.logoUrl} alt="" className="h-10 w-10 rounded-[0.875rem] object-cover" />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-[0.875rem] text-sm font-black"
              style={{
                background: `rgba(${hexToRgb(theme.secondaryColor)}, 0.2)`,
                color: theme.secondaryColor,
                border: `1px solid rgba(${hexToRgb(theme.secondaryColor)}, 0.35)`,
              }}
            >
              {theme.logoText}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight tracking-tight text-white">{theme.companyName}</p>
          <p
            className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: `rgba(${hexToRgb(theme.secondaryColor)}, 0.85)` }}
          >
            CRM
          </p>
        </div>
      </div>

      <div className="mx-3 mb-2 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="flex flex-1 flex-col overflow-y-auto px-2.5 pb-3">
        <p className="mb-2 px-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Menu</p>
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const href = `${item.path}${qs}`
            const basePath = item.path
            const isActive = pathname.startsWith(basePath)
            const isThisPending = isPending && pendingPath === basePath

            return (
              <NavLink
                key={item.key}
                href={href}
                label={item.label}
                navKey={item.key}
                secondaryColor={theme.secondaryColor}
                isActive={isActive}
                isPending={isThisPending}
                onClick={(e) => {
                  e.preventDefault()
                  if (isActive) return
                  setPendingPath(basePath)
                  requestAnimationFrame(() => {
                    startTransition(() => {
                      router.push(href)
                    })
                  })
                }}
              />
            )
          })}
        </nav>
      </div>

      <BulkJobsIndicator locationId={locationId} />

      <div className="border-t border-white/[0.07] px-4 py-3.5">
        <p className="text-center text-[10px] font-medium tracking-wide text-white/30">Bibot Core · 2026</p>
      </div>
    </aside>
  )
}
