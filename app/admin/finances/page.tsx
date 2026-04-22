import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { isBibotAgency } from '@/lib/isBibotAgency'
import FinancesClient from './_components/FinancesClient'
import { ad } from '@/lib/admin/ui'

export const dynamic = 'force-dynamic'

export default async function FinancesPage() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id').eq('id', user.id).single()
  if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) redirect('/admin')

  const agencyId = profile.agency_id

  // Get MRR from locations with plans
  const [{ data: locations }, { data: ghlPlans }, { data: costs }] = await Promise.all([
    sb.from('locations').select('ghl_plan_id').eq('agency_id', agencyId).not('ghl_plan_id', 'is', null),
    sb.from('ghl_plans').select('ghl_plan_id, price_monthly'),
    sb.from('agency_costs').select('id, name, amount, frequency').eq('agency_id', agencyId).order('created_at'),
  ])

  const planPrices: Record<string, number> = {}
  for (const p of ghlPlans ?? []) {
    if (p.price_monthly != null) planPrices[p.ghl_plan_id] = Number(p.price_monthly)
  }

  let mrr = 0
  for (const loc of locations ?? []) {
    if (loc.ghl_plan_id && planPrices[loc.ghl_plan_id]) {
      mrr += planPrices[loc.ghl_plan_id]
    }
  }

  const typedCosts = (costs ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    amount: Number(c.amount),
    frequency: c.frequency as 'monthly' | 'annual',
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className={ad.pageTitle}>Finances</h1>
        <p className={ad.pageSubtitle}>Track your costs and profitability</p>
      </div>
      <FinancesClient costs={typedCosts} mrr={mrr} />
    </div>
  )
}
