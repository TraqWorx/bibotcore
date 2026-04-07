import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import Link from 'next/link'

const getPlatformData = cache(async () => {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return null

  const [{ count: agencyCount }, { count: locationCount }] = await Promise.all([
    sb.from('agencies').select('id', { count: 'exact', head: true }),
    sb.from('agency_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  return { agencyCount: agencyCount ?? 0, locationCount: locationCount ?? 0 }
})

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const data = await getPlatformData()
  if (!data) redirect('/login')

  const navLinks = [
    { href: '/platform', label: 'Overview' },
    { href: '/platform/agencies', label: 'Agencies', count: data.agencyCount },
    { href: '/platform/revenue', label: 'Revenue' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-sm font-black text-white">
              GD
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">GHL Dash</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Platform Admin</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              >
                {link.label}
                {link.count != null && link.count > 0 && (
                  <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">{link.count}</span>
                )}
              </Link>
            ))}
          </nav>
          <form action="/api/auth/signout" method="post">
            <button className="text-xs font-medium text-gray-400 hover:text-gray-600">Logout</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        {children}
      </main>
    </div>
  )
}
