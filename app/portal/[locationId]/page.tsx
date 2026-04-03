import { redirect } from 'next/navigation'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

/**
 * Portal home page — shows the customer's profile, deals, and recent activity.
 */
export default async function PortalHomePage({
  params,
}: {
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect(`/portal/login?locationId=${locationId}`)

  const sb = createAdminClient()

  // Get portal user mapping
  const { data: portalUser } = await sb
    .from('portal_users')
    .select('contact_ghl_id')
    .eq('auth_user_id', user.id)
    .eq('location_id', locationId)
    .single()

  if (!portalUser) redirect(`/portal/login?locationId=${locationId}`)

  const contactGhlId = portalUser.contact_ghl_id

  // Fetch contact data, opportunities, and custom fields from cache
  const [
    { data: contact },
    { data: opportunities },
    { data: customFields },
    { data: fieldDefs },
  ] = await Promise.all([
    sb.from('cached_contacts')
      .select('first_name, last_name, email, phone, company_name, tags')
      .eq('location_id', locationId)
      .eq('ghl_id', contactGhlId)
      .single(),
    sb.from('cached_opportunities')
      .select('ghl_id, name, status, monetary_value')
      .eq('location_id', locationId)
      .eq('contact_ghl_id', contactGhlId)
      .order('synced_at', { ascending: false }),
    sb.from('cached_contact_custom_fields')
      .select('field_id, value')
      .eq('location_id', locationId)
      .eq('contact_ghl_id', contactGhlId),
    sb.from('cached_custom_fields')
      .select('field_id, name, data_type')
      .eq('location_id', locationId),
  ])

  // Build field name map
  const fieldNameMap = new Map<string, string>()
  for (const f of fieldDefs ?? []) {
    fieldNameMap.set(f.field_id, f.name ?? f.field_id)
  }

  // Filter out internal/hidden fields
  const visibleCustomFields = (customFields ?? []).filter((cf) => {
    const name = fieldNameMap.get(cf.field_id) ?? ''
    return cf.value && !name.startsWith('[Provv.') && !name.startsWith('[Staff')
  })

  const contactName = [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || 'Cliente'

  // Calculate total monetary value from opportunities
  const totalValue = (opportunities ?? []).reduce(
    (sum, opp) => sum + (Number(opp.monetary_value) || 0),
    0,
  )

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ciao, {contactName}</h1>
        <p className="mt-1 text-sm text-gray-500">Ecco un riepilogo del tuo account</p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Contratti</p>
          <p className="mt-2 text-3xl font-black text-gray-900">{(opportunities ?? []).length}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Valore Totale</p>
          <p className="mt-2 text-3xl font-black text-gray-900">
            {totalValue.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Tags</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(contact?.tags ?? []).map((tag: string) => (
              <span key={tag} className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                {tag}
              </span>
            ))}
            {(contact?.tags ?? []).length === 0 && (
              <span className="text-sm text-gray-400">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-400">I Tuoi Dati</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-gray-400">Nome</p>
            <p className="font-medium text-gray-900">{contactName}</p>
          </div>
          {contact?.email && (
            <div>
              <p className="text-xs text-gray-400">Email</p>
              <p className="font-medium text-gray-900">{contact.email}</p>
            </div>
          )}
          {contact?.phone && (
            <div>
              <p className="text-xs text-gray-400">Telefono</p>
              <p className="font-medium text-gray-900">{contact.phone}</p>
            </div>
          )}
          {contact?.company_name && (
            <div>
              <p className="text-xs text-gray-400">Azienda</p>
              <p className="font-medium text-gray-900">{contact.company_name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Custom fields */}
      {visibleCustomFields.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-400">Dettagli</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visibleCustomFields.map((cf) => (
              <div key={cf.field_id}>
                <p className="text-xs text-gray-400">{fieldNameMap.get(cf.field_id) ?? cf.field_id}</p>
                <p className="font-medium text-gray-900">{cf.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opportunities / Deals */}
      {(opportunities ?? []).length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-400">I Tuoi Contratti</h2>
          <div className="space-y-3">
            {(opportunities ?? []).map((opp) => (
              <div
                key={opp.ghl_id}
                className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/50 p-4"
              >
                <div>
                  <p className="font-medium text-gray-900">{opp.name ?? 'Contratto'}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Stato: <span className="font-medium capitalize">{opp.status ?? '—'}</span>
                  </p>
                </div>
                {opp.monetary_value != null && Number(opp.monetary_value) > 0 && (
                  <span className="text-lg font-bold text-gray-900">
                    {Number(opp.monetary_value).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
