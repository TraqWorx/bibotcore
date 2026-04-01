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
    <nav className="space-y-1">
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
            className={`flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? 'border border-brand/25 bg-brand/10 text-brand shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span>{link.label}</span>
            {link.count !== undefined && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                active ? 'bg-brand/15 text-brand' : 'bg-gray-100 text-gray-500'
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
