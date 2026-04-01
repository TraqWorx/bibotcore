import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAuthClient } from '@/lib/supabase-server'
import AgencyNavClient from './_components/AgencyNavClient'
import LogoutButton from '../admin/_components/LogoutButton'
import { ad } from '@/lib/admin/ui'

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-[#f5f5f8]">
      {/* Top nav */}
      <header className="sticky top-0 z-10 border-b border-gray-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Logo */}
          <Link href="/agency" className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand/10 text-sm font-black text-brand ring-1 ring-brand/15">
              Bi
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900 leading-none">Bibot Core Agency</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Agency</p>
            </div>
          </Link>

          {/* Nav links */}
          <AgencyNavClient />

          {/* Right */}
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden max-w-[16rem] truncate text-xs text-gray-500 sm:block">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <div className={`${ad.card} ${ad.cardPadding}`}>
          {children}
        </div>
      </main>
    </div>
  )
}
