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
    href: `${BASE}/conversazioni`,
    label: 'Conversazioni',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="bs-nav-icon">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    href: `${BASE}/servizi`,
    label: 'Servizi',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="bs-nav-icon">
        <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5V5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v3.5c0 .83-.67 1.5-1.5 1.5z"/>
        <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        <path d="M9.5 14c.83 0 1.5.67 1.5 1.5V19c0 .83-.67 1.5-1.5 1.5S8 19.83 8 19v-3.5c0-.83.67-1.5 1.5-1.5z"/>
        <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/>
        <path d="M14 14.5c0-.83.67-1.5 1.5-1.5H19c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3.5c-.83 0-1.5-.67-1.5-1.5z"/>
        <path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
        <path d="M10 9.5C10 8.67 9.33 8 8.5 8H5c-.83 0-1.5.67-1.5 1.5S4.17 11 5 11h3.5c.83 0 1.5-.67 1.5-1.5z"/>
        <path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/>
      </svg>
    ),
  },
]

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname() ?? ''

  return (
    <aside className="bs-sidebar">
      <div className="bs-brand">
        <div style={{ padding: '8px 4px 4px' }}>
          <div style={{
            color: 'white',
            fontSize: 26,
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontStyle: 'italic',
            fontWeight: 400,
            letterSpacing: '0.04em',
            lineHeight: 1.1,
          }}>
            Bellessere
          </div>
          <div style={{
            fontSize: 9,
            color: 'rgba(201,168,76,0.7)',
            textTransform: 'uppercase',
            letterSpacing: '0.22em',
            marginTop: 5,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontStyle: 'normal',
          }}>
            hair &amp; beauty
          </div>
        </div>
      </div>

      <nav className="bs-nav">
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
      </nav>

      <div className="bs-nav-bottom">
        <div className="bs-user-info">
          <div className="bs-user-label">Connesso come</div>
          <div className="bs-user-email">{email}</div>
        </div>
        <LogoutButton />
      </div>
    </aside>
  )
}
