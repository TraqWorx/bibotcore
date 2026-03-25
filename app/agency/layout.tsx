import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAuthClient } from '@/lib/supabase-server'
import AgencyNavClient from './_components/AgencyNavClient'
import LogoutButton from '../admin/_components/LogoutButton'

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen" style={{ background: '#f5f5f8' }}>
      {/* Top nav */}
      <header
        className="sticky top-0 z-10 border-b border-[rgba(255,255,255,0.08)]"
        style={{ background: 'linear-gradient(90deg, #2A00CC 0%, #1A0099 100%)' }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          {/* Logo */}
          <Link href="/agency" className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-black"
              style={{ background: 'rgba(0,240,255,0.2)', color: '#00F0FF', border: '1px solid rgba(0,240,255,0.3)' }}
            >
              Bi
            </div>
            <span className="text-sm font-bold text-white">Bibot Core Agency</span>
          </Link>

          {/* Nav links */}
          <AgencyNavClient />

          {/* Right */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-[rgba(255,255,255,0.4)]">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-7xl p-8">{children}</main>
    </div>
  )
}
