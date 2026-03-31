'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { darkenHex } from '@/lib/utils/colorUtils'
import type { DesignTheme, DesignModules } from '@/lib/types/design'

const MODULE_NAV = [
  { key: 'dashboard',   label: 'Dashboard',    path: '/designs/simfonia/dashboard' },
  { key: 'contacts',       label: 'Contatti',       path: '/designs/simfonia/contacts' },
  { key: 'conversations',  label: 'Conversazioni', path: '/designs/simfonia/conversations' },
  { key: 'pipeline',       label: 'Pipeline',       path: '/designs/simfonia/pipeline' },
  { key: 'calendar',    label: 'Calendario',   path: '/designs/simfonia/calendar' },
  { key: 'settings',    label: 'Impostazioni', path: '/designs/simfonia/settings' },
] as const

function NavLink({
  href,
  label,
  secondaryColor,
}: {
  href: string
  label: string
  secondaryColor: string
}) {
  const pathname = usePathname()
  const active = pathname.startsWith(href.split('?')[0])

  return (
    <Link
      href={href}
      prefetch={true}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150"
      style={
        active
          ? {
              background: `rgba(${hexToRgb(secondaryColor)}, 0.15)`,
              color: secondaryColor,
              border: `1px solid rgba(${hexToRgb(secondaryColor)}, 0.25)`,
            }
          : { color: 'rgba(255,255,255,0.65)' }
      }
    >
      {label}
    </Link>
  )
}

function hexToRgb(hex: string): string {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) return '255,255,255'
  const n = parseInt(cleaned, 16)
  return `${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff}`
}

interface GymSidebarProps {
  theme: DesignTheme
  modules: DesignModules
  locationId: string
}

export default function GymSidebar({ theme, modules, locationId }: GymSidebarProps) {
  const darkBg = darkenHex(theme.primaryColor, 0.15)
  const qs = locationId ? `?locationId=${locationId}` : ''

  const navItems = MODULE_NAV.filter((item) => {
    const mod = modules[item.key as keyof DesignModules]
    // show if explicitly enabled or module key not set (default = enabled)
    return mod === undefined || mod.enabled !== false
  })

  return (
    <aside
      className="w-60 shrink-0 flex flex-col"
      style={{ background: `linear-gradient(180deg, ${theme.primaryColor} 0%, ${darkBg} 100%)` }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[rgba(255,255,255,0.08)]">
        {theme.logoUrl ? (
          <img src={theme.logoUrl} alt="logo" className="h-8 w-8 rounded-lg object-cover" />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black"
            style={{
              background: `rgba(${hexToRgb(theme.secondaryColor)}, 0.2)`,
              color: theme.secondaryColor,
              border: `1px solid rgba(${hexToRgb(theme.secondaryColor)}, 0.3)`,
            }}
          >
            {theme.logoText}
          </div>
        )}
        <div>
          <p className="text-sm font-bold text-white leading-none">{theme.companyName}</p>
          <p className="text-[10px] leading-none mt-0.5 uppercase tracking-wider" style={{ color: `rgba(${hexToRgb(theme.secondaryColor)}, 0.7)` }}>
            CRM Platform
          </p>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-[rgba(255,255,255,0.35)]">
          CRM
        </p>
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.key}
              href={`${item.path}${qs}`}
              label={item.label}
              secondaryColor={theme.secondaryColor}
            />
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[rgba(255,255,255,0.08)]">
        <p className="text-[10px] text-[rgba(255,255,255,0.25)] text-center">Bibot Core © 2026</p>
      </div>
    </aside>
  )
}
