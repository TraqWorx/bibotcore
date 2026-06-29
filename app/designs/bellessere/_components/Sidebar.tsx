'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from '@/app/admin/_components/LogoutButton'

const BASE = '/designs/bellessere'

const NAV = [
  {
    href: `${BASE}/dashboard`,
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="bs-nav-icon">
        <rect x="3" y="3" width="7" height="9" rx="1.5"/>
        <rect x="14" y="3" width="7" height="5" rx="1.5"/>
        <rect x="14" y="12" width="7" height="9" rx="1.5"/>
        <rect x="3" y="16" width="7" height="5" rx="1.5"/>
      </svg>
    ),
  },
  {
    href: `${BASE}/calendario`,
    label: 'Calendario',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="bs-nav-icon">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: `${BASE}/appuntamenti`,
    label: 'Appuntamenti',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="bs-nav-icon">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
      </svg>
    ),
  },
  {
    href: `${BASE}/clienti`,
    label: 'Clienti',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="bs-nav-icon">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: `${BASE}/servizi`,
    label: 'Servizi',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="bs-nav-icon">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
]

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname() ?? ''

  return (
    <aside className="bs-sidebar">
      <div className="bs-brand">
        <div className="bs-brand-mark">B</div>
        <div className="bs-brand-text">
          Bellessere
          <small>Barber CRM</small>
        </div>
      </div>

      <div className="bs-nav">
        <div className="bs-nav-section">Menu</div>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            data-active={pathname.startsWith(item.href) ? 'true' : 'false'}
            className="bs-nav-link"
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="bs-nav-bottom">
        <div style={{ padding: '8px 10px', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
          Connesso come<br />
          <span style={{ color: 'white', fontWeight: 600, wordBreak: 'break-all' }}>{email}</span>
        </div>
        <div style={{ padding: '4px 4px 0' }}>
          <LogoutButton />
        </div>
      </div>
    </aside>
  )
}
