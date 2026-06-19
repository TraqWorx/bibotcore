'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from '@/app/admin/_components/LogoutButton'

interface NavItem { href: string; label: string; icon: React.ReactNode }

const ICON = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="fc-nav-icon"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>,
  contacts: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="fc-nav-icon"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  orders: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="fc-nav-icon"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="fc-nav-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="fc-nav-icon"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
}

const NAV: NavItem[] = [
  { href: '/designs/farmacia-cialdella/dashboard', label: 'Dashboard', icon: ICON.dashboard },
  { href: '/designs/farmacia-cialdella/clienti', label: 'Clienti', icon: ICON.contacts },
  { href: '/designs/farmacia-cialdella/ordini', label: 'Ordini', icon: ICON.orders },
  { href: '/designs/farmacia-cialdella/imports', label: 'Importazioni', icon: ICON.upload },
]

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname() ?? ''
  return (
    <aside className="fc-sidebar">
      <div className="fc-brand">
        <div className="fc-brand-mark" style={{ background: 'white', padding: 0, overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/farmacia-cialdella-logo.jpeg" alt="Farmacia Cialdella" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div className="fc-brand-text">Farmacia Cialdella<small>Gestione vendite</small></div>
      </div>

      <div className="fc-nav">
        <div className="fc-nav-section">Gestione</div>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} data-active={pathname.startsWith(item.href)} className="fc-nav-link">
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
        <div className="fc-nav-section">Sistema</div>
        <Link href="/designs/farmacia-cialdella/settings" data-active={pathname.startsWith('/designs/farmacia-cialdella/settings')} className="fc-nav-link">
          {ICON.settings}
          <span>Impostazioni</span>
        </Link>
      </div>

      <div className="fc-nav-bottom">
        <div style={{ padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
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
