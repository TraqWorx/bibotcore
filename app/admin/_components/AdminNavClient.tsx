'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type NavLink = { href: string; label: string; count?: number }

export default function AdminNavClient({ navLinks }: { navLinks: NavLink[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  return (
    <nav className="space-y-0.5">
      {navLinks.map((link) => {
        const isActive = link.href === '/admin'
          ? pathname === '/admin'
          : pathname.startsWith(link.href)
        const isThisPending = isPending && pendingHref === link.href
        const active = isActive || isThisPending

        return (
          <a
            key={link.href}
            href={link.href}
            onClick={(e) => {
              e.preventDefault()
              if (isActive) return
              setPendingHref(link.href)
              requestAnimationFrame(() => {
                startTransition(() => { router.push(link.href) })
              })
            }}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
              active
                ? 'bg-[rgba(0,240,255,0.15)] text-[#00F0FF] border border-[rgba(0,240,255,0.25)]'
                : 'text-[rgba(255,255,255,0.65)] hover:text-white hover:bg-[rgba(255,255,255,0.07)]'
            }`}
          >
            <span>{link.label}</span>
            {link.count !== undefined && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                active
                  ? 'bg-[rgba(0,240,255,0.2)] text-[#00F0FF]'
                  : 'bg-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.5)]'
              }`}>
                {link.count}
              </span>
            )}
          </a>
        )
      })}
    </nav>
  )
}
