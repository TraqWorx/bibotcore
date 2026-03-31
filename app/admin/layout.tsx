import { redirect } from 'next/navigation'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import AdminNavClient from './_components/AdminNavClient'
import LogoutButton from './_components/LogoutButton'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') redirect('/dashboard')
  const [
    { count: userCount },
    { count: locationCount },
    { count: designCount },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }).neq('role', 'super_admin'),
    admin.from('ghl_connections').select('*', { count: 'exact', head: true }),
    admin.from('designs').select('*', { count: 'exact', head: true }),
  ])

  const navLinks = [
    { href: '/admin',              label: 'Dashboard' },
    { href: '/admin/users',        label: 'Utenti',       count: userCount ?? 0 },
    { href: '/admin/designs',      label: 'Designs',      count: designCount ?? 0 },
    { href: '/admin/locations',    label: 'Locations',    count: locationCount ?? 0 },
    { href: '/admin/plan-mapping', label: 'Plan Mapping' },
  ]

  return (
    <div className="flex min-h-screen" style={{ background: '#f5f5f8' }}>
      {/* Sidebar */}
      <aside
        className="w-60 shrink-0 flex flex-col"
        style={{ background: 'linear-gradient(180deg, #2A00CC 0%, #1A0099 100%)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[rgba(255,255,255,0.08)]">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black"
            style={{ background: 'rgba(0,240,255,0.2)', color: '#00F0FF', border: '1px solid rgba(0,240,255,0.3)' }}
          >
            Bi
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">Bibot Core Admin</p>
            <p className="text-[10px] text-[rgba(0,240,255,0.7)] leading-none mt-0.5 uppercase tracking-wider">Super Admin</p>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 px-3 py-4">
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-[rgba(255,255,255,0.35)]">
            Piattaforma
          </p>
          <AdminNavClient navLinks={navLinks} />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[rgba(255,255,255,0.08)] flex items-center justify-between">
          <p className="text-[10px] text-[rgba(255,255,255,0.25)]">Bibot Core © 2026</p>
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
