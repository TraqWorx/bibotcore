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
  const [{ data: locations }, { data: ghlPlans }, { data: costs }, { data: vatPayments }, { data: allLocations }, { data: vatStatuses }] = await Promise.all([
    sb.from('locations').select('ghl_plan_id').eq('agency_id', agencyId).not('ghl_plan_id', 'is', null).is('churned_at', null),
    sb.from('ghl_plans').select('ghl_plan_id, price_monthly'),
    sb.from('agency_costs').select('id, name, amount, frequency, payment_date').eq('agency_id', agencyId).order('created_at'),
    sb.from('vat_payments').select('id, amount, period, notes, paid_at').eq('agency_id', agencyId).order('paid_at', { ascending: false }),
    sb.from('locations').select('ghl_plan_id, ghl_date_added, churned_at').eq('agency_id', agencyId).not('ghl_plan_id', 'is', null),
    sb.from('vat_quarter_status').select('quarter, status, amount_paid').eq('agency_id', agencyId),
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

  // Calculate VAT per quarter per location
  // Italian quarterly VAT schedule:
  // Q1 (Jan-Mar) → pay by 16/05
  // Q2 (Apr-Jun) → pay by 20/08
  // Q3 (Jul-Sep) → pay by 16/11
  // Q4 (Oct-Dec) → pay by 16/03 next year
  // Acconto IVA (27/12) → 88% of Q4 previous year

  interface VatQuarter {
    quarter: string       // e.g. "Q1 2026"
    period: string        // e.g. "Jan - Mar 2026"
    paymentDeadline: string // e.g. "16/05/2026"
    vatAmount: number
    year: number
    q: number
  }

  /** Calculate prorated revenue for a location in a date range.
   *  Returns the sum of (planPrice × fraction of month active) for each month in the range.
   *  Partial months are prorated by days (days active / days in month). */
  function getProratedRevenueInRange(locStartRaw: Date, locEndRaw: Date | null, rangeStart: Date, rangeEnd: Date, monthlyPrice: number): number {
    let total = 0
    // Normalize to local dates (strip timezone)
    const locStart = new Date(locStartRaw.getFullYear(), locStartRaw.getMonth(), locStartRaw.getDate())
    const locEnd = locEndRaw ? new Date(locEndRaw.getFullYear(), locEndRaw.getMonth(), locEndRaw.getDate()) : null

    const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    while (cursor <= rangeEnd) {
      const y = cursor.getFullYear(), m = cursor.getMonth()
      const monthStart = new Date(y, m, 1)
      const monthEnd = new Date(y, m + 1, 0) // last day of month
      const daysInMonth = monthEnd.getDate()

      const effStart = locStart > monthStart ? locStart : monthStart
      const effEnd = locEnd && locEnd < monthEnd ? locEnd : monthEnd

      if (effStart <= effEnd) {
        const daysActive = Math.round((effEnd.getTime() - effStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
        const fraction = Math.min(daysActive / daysInMonth, 1)
        total += monthlyPrice * fraction
      }

      cursor.setMonth(cursor.getMonth() + 1)
    }
    return total
  }

  const quarterDefs = [
    { q: 1, months: [0, 1, 2], label: 'Jan - Mar', deadlineMonth: 4, deadlineDay: 16 },
    { q: 2, months: [3, 4, 5], label: 'Apr - Jun', deadlineMonth: 7, deadlineDay: 20 },
    { q: 3, months: [6, 7, 8], label: 'Jul - Sep', deadlineMonth: 10, deadlineDay: 16 },
    { q: 4, months: [9, 10, 11], label: 'Oct - Dec', deadlineMonth: 2, deadlineDay: 16, deadlineNextYear: true },
  ]

  // Calculate VAT per quarter from actual Stripe charges
  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear]

  // Fetch all Stripe charges for VAT calculation
  let allCharges: { amount: number; created: number }[] = []
  try {
    const Stripe = (await import('stripe')).default
    const ghlStripeKey = process.env.STRIPE_GHL_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY
    if (ghlStripeKey) {
      const stripe = new Stripe(ghlStripeKey)
      const oldestStart = Math.floor(new Date(currentYear - 1, 0, 1).getTime() / 1000)
      let hasMore = true
      let startingAfter: string | undefined
      while (hasMore) {
        const page = await stripe.charges.list({
          created: { gte: oldestStart },
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        })
        for (const c of page.data) {
          if (c.status === 'succeeded' && c.amount > 500) { // exclude test charges
            allCharges.push({ amount: c.amount, created: c.created })
          }
        }
        hasMore = page.has_more
        if (page.data.length > 0) startingAfter = page.data[page.data.length - 1].id
      }
    }
  } catch { /* ignore Stripe errors */ }

  const vatQuarters: VatQuarter[] = []
  let totalVatOwed = 0

  for (const year of years) {
    for (const qd of quarterDefs) {
      const rangeStart = new Date(year, qd.months[0], 1)
      const rangeEnd = new Date(year, qd.months[2] + 1, 0, 23, 59, 59)
      const rangeStartTs = Math.floor(rangeStart.getTime() / 1000)
      const rangeEndTs = Math.floor(rangeEnd.getTime() / 1000)

      // Sum gross charges in this quarter, VAT = gross - (gross / 1.22)
      const quarterCharges = allCharges.filter(c => c.created >= rangeStartTs && c.created <= rangeEndTs)
      const quarterGross = quarterCharges.reduce((s, c) => s + c.amount, 0) / 100
      const quarterVat = quarterGross - (quarterGross / 1.22) // VAT included in gross

      if (quarterVat > 0) {
        const deadlineYear = qd.deadlineNextYear ? year + 1 : year
        vatQuarters.push({
          quarter: `Q${qd.q} ${year}`,
          period: `${qd.label} ${year}`,
          paymentDeadline: `${String(qd.deadlineDay).padStart(2, '0')}/${String(qd.deadlineMonth + 1).padStart(2, '0')}/${deadlineYear}`,
          vatAmount: quarterVat,
          year,
          q: qd.q,
        })
        totalVatOwed += quarterVat
      }
    }
  }

  // Acconto IVA (27/12 current year) = 88% of Q4 previous year
  const q4PrevYear = vatQuarters.find((v) => v.year === currentYear - 1 && v.q === 4)
  const accontoIva = q4PrevYear ? q4PrevYear.vatAmount * 0.88 : 0

  // Fetch affiliate monthly cost (owed ÷ months active)
  let affiliateMonthlyCost = 0
  let affiliateTotalOwed = 0
  try {
    const { refreshIfNeeded } = await import('@/lib/ghl/refreshIfNeeded')
    const { data: conns } = await sb.from('ghl_connections').select('location_id, access_token, refresh_token, expires_at, company_id').not('refresh_token', 'is', null).limit(5)
    for (const conn of conns ?? []) {
      const token = await refreshIfNeeded(conn.location_id, conn)
      // Get location token for affiliate API
      const cid = conn.company_id ?? process.env.GHL_COMPANY_ID ?? ''
      const ltRes = await fetch('https://services.leadconnectorhq.com/oauth/locationToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Bearer ${conn.access_token}`, Version: '2021-07-28' },
        body: new URLSearchParams({ companyId: cid, locationId: conn.location_id }),
      })
      if (!ltRes.ok) continue
      const { access_token: affToken } = await ltRes.json()
      if (!affToken) continue

      const affRes = await fetch(`https://services.leadconnectorhq.com/affiliate-manager/${conn.location_id}/affiliates`, {
        headers: { Authorization: `Bearer ${affToken}`, Version: '2021-07-28' },
      })
      if (!affRes.ok) continue
      const affData = await affRes.json()
      // Get campaign commission rates
      for (const a of (affData.affiliates ?? []) as { _id?: string; owned?: number; campaignIds?: string[]; customer?: number }[]) {
        affiliateTotalOwed += a.owned ?? 0
        // Get commission rate from campaign
        let commRate = 0
        if (a.campaignIds?.[0]) {
          const campRes = await fetch(`https://services.leadconnectorhq.com/affiliate-manager/${conn.location_id}/campaigns/${a.campaignIds[0]}`, {
            headers: { Authorization: `Bearer ${affToken}`, Version: '2021-07-28' },
          })
          if (campRes.ok) {
            const camp = await campRes.json()
            commRate = (camp.commissionV2?.[0]?.defaultCommission?.commission ?? 0) / 100
          }
        }
        // Get customer plan prices
        if (commRate > 0 && a._id) {
          const custRes = await fetch(`https://services.leadconnectorhq.com/affiliate-manager/${conn.location_id}/affiliates/${a._id}/customers`, {
            headers: { Authorization: `Bearer ${affToken}`, Version: '2021-07-28' },
          })
          if (custRes.ok) {
            const custData2 = await custRes.json()
            for (const c of custData2.customers ?? []) {
              const email = (c.email as string | undefined)?.toLowerCase()
              if (email) {
                // Match to location plan
                const { data: prof } = await sb.from('profiles').select('location_id').eq('email', email).maybeSingle()
                if (prof?.location_id) {
                  const { data: loc } = await sb.from('locations').select('ghl_plan_id').eq('location_id', prof.location_id).single()
                  if (loc?.ghl_plan_id) {
                    const { data: plan } = await sb.from('ghl_plans').select('price_monthly').eq('ghl_plan_id', loc.ghl_plan_id).single()
                    if (plan?.price_monthly) affiliateMonthlyCost += Number(plan.price_monthly) * commRate
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch { /* ignore */ }

  const typedCosts = (costs ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    amount: Number(c.amount),
    frequency: c.frequency as 'monthly' | 'annual',
    paymentDate: c.payment_date as string | null,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className={ad.pageTitle}>Finances</h1>
        <p className={ad.pageSubtitle}>Track your costs and profitability</p>
      </div>
      <FinancesClient
        costs={typedCosts}
        mrr={mrr}
        monthlyVat={mrr * 0.22}
        totalVatOwed={totalVatOwed}
        vatQuarters={vatQuarters}
        accontoIva={accontoIva}
        vatStatusMap={Object.fromEntries((vatStatuses ?? []).map(s => [s.quarter, { status: s.status as 'pending' | 'paid' | 'partial', amountPaid: Number(s.amount_paid) }]))}
        vatPayments={(vatPayments ?? []).map(p => ({ id: p.id as string, amount: Number(p.amount), period: p.period as string, notes: p.notes as string | null, paid_at: p.paid_at as string }))}
        affiliateMonthlyCost={affiliateMonthlyCost}
        affiliateTotalOwed={affiliateTotalOwed}
      />
    </div>
  )
}
