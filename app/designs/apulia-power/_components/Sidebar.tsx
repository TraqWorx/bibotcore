'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from '@/app/admin/_components/LogoutButton'

interface NavItem { href: string; label: string; icon: React.ReactNode }

const ICON = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ap-nav-icon"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>,
  contacts: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ap-nav-icon"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  admin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ap-nav-icon"><path d="M20 7h-7"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>,
  switchOut: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ap-nav-icon"><path d="M9 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ap-nav-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  euro: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ap-nav-icon"><path d="M21 14a8 8 0 1 1 0-4"/><line x1="3" y1="9" x2="14" y2="9"/><line x1="3" y1="15" x2="14" y2="15"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ap-nav-icon"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
}

const OWNER_NAV: NavItem[] = [
  { href: '/designs/apulia-power/dashboard', label: 'Dashboard', icon: ICON.dashboard },
  { href: '/designs/apulia-power/condomini', label: 'Condomini', icon: ICON.contacts },
  { href: '/designs/apulia-power/amministratori', label: 'Amministratori', icon: ICON.admin },
  { href: '/designs/apulia-power/switch-out', label: 'Switch-out', icon: ICON.switchOut },
  { href: '/designs/apulia-power/imports', label: 'Imports', icon: ICON.upload },
  { href: '/designs/apulia-power/pagamenti', label: 'Pagamenti', icon: ICON.euro },
]

const AMM_NAV: NavItem[] = [
  { href: '/designs/apulia-power/dashboard', label: 'Dashboard', icon: ICON.dashboard },
  { href: '/designs/apulia-power/i-miei-condomini', label: 'I miei condomini', icon: ICON.contacts },
  { href: '/designs/apulia-power/i-miei-pagamenti', label: 'I miei pagamenti', icon: ICON.euro },
]

export default function Sidebar({ role, email }: { role: 'owner' | 'amministratore'; email: string }) {
  const pathname = usePathname() ?? ''
  const items = role === 'owner' ? OWNER_NAV : AMM_NAV
  return (
    <aside className="ap-sidebar">
      <div className="ap-brand">
        <div className="ap-brand-mark">AP</div>
        <div className="ap-brand-text">Apulia Power<small>Rete commerciale</small></div>
      </div>

      <div className="ap-nav">
        <div className="ap-nav-section">{role === 'owner' ? 'Gestione' : 'Area personale'}</div>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            data-active={pathname.startsWith(item.href)}
            className="ap-nav-link"
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
        {role === 'owner' && (
          <>
            <div className="ap-nav-section">Sistema</div>
            <Link
              href="/designs/apulia-power/settings"
              data-active={pathname.startsWith('/designs/apulia-power/settings')}
              className="ap-nav-link"
            >
              {ICON.settings}
              <span>Impostazioni</span>
            </Link>
          </>
        )}
      </div>

      <div className="ap-nav-bottom">
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
