import { redirect } from 'next/navigation'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

/**
 * Portal layout — authenticates the portal user and ensures the
 * portal_users mapping exists (creates it on first login).
 */
export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    redirect(`/portal/login?locationId=${locationId}`)
  }

  const sb = createAdminClient()
  const email = user.email?.toLowerCase()

  // Check if portal_users mapping exists for THIS location
  let { data: portalUser } = await sb
    .from('portal_users')
    .select('contact_ghl_id, location_id')
    .eq('auth_user_id', user.id)
    .single()

  // If mapping exists but for a different location, deny access
  if (portalUser && portalUser.location_id !== locationId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="max-w-sm rounded-2xl border border-red-200 bg-white p-8 text-center">
          <p className="text-sm text-red-600">
            Il tuo account non è associato a questa location.
          </p>
        </div>
      </div>
    )
  }

  // If not, try to create the mapping from cached contacts
  if (!portalUser && email) {
    const { data: contact } = await sb
      .from('cached_contacts')
      .select('ghl_id')
      .eq('location_id', locationId)
      .ilike('email', email)
      .limit(1)
      .single()

    if (contact) {
      await sb.from('portal_users').upsert(
        {
          auth_user_id: user.id,
          location_id: locationId,
          contact_ghl_id: contact.ghl_id,
        },
        { onConflict: 'auth_user_id' },
      )
      portalUser = { contact_ghl_id: contact.ghl_id, location_id: locationId }
    }
  }

  if (!portalUser) {
    // User authenticated but no matching contact — show error
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="max-w-sm rounded-2xl border border-red-200 bg-white p-8 text-center">
          <p className="text-sm text-red-600">
            Nessun contatto associato a questo account. Contatta il supporto.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Portal header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2A00CC] to-[#6366f1]">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900">Area Clienti</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{email}</span>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="text-sm font-medium text-gray-400 hover:text-gray-600"
              >
                Esci
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Portal nav */}
      <nav className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-5xl gap-6 px-6">
          <a href={`/portal/${locationId}`} className="border-b-2 border-transparent py-3 text-sm font-medium text-gray-500 hover:text-gray-900">Dashboard</a>
          <a href={`/portal/${locationId}/appointments`} className="border-b-2 border-transparent py-3 text-sm font-medium text-gray-500 hover:text-gray-900">Appuntamenti</a>
          <a href={`/portal/${locationId}/messages`} className="border-b-2 border-transparent py-3 text-sm font-medium text-gray-500 hover:text-gray-900">Messaggi</a>
          <a href={`/portal/${locationId}/invoices`} className="border-b-2 border-transparent py-3 text-sm font-medium text-gray-500 hover:text-gray-900">Fatture</a>
        </div>
      </nav>

      {/* Portal content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {children}
      </main>
    </div>
  )
}
